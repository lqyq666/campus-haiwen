import type { AssessmentReport } from "@/domain/recommendation/models";
import { normalizeSchoolMatchTier } from "@/domain/recommendation/models";
import type { CalibrationCase, CalibrationComparison } from "./models";

const riskMap: Record<string, string[]> = {
  competition: ["COMPETITION"],
  english: ["ENGLISH", "CET"],
  policy: ["POLICY"],
  "profile-completeness": ["PROFILE", "MISSING"],
  ranking: ["RANK", "PROFILE_INCOMPLETE"],
  research: ["RESEARCH"],
  "target-fit": ["TARGET"],
  timing: ["TIME"],
};
const actionMap: Record<string, string[]> = {
  BUILD_RESEARCH: ["RESEARCH"],
  CLARIFY_TARGET: ["TARGET"],
  IMPROVE_ENGLISH: ["ENGLISH"],
  IMPROVE_RANKING: ["RANK"],
  OTHER: [],
  START_EXAM_PREP: ["EXAM"],
  STRENGTHEN_COMPETITION: ["COMPETITION"],
  VERIFY_POLICY: ["POLICY"],
};
export function compareCalibrationResult(
  caseItem: CalibrationCase,
  report: AssessmentReport
): CalibrationComparison {
  const expectation = caseItem.expertExpectation;
  const risks = [...report.topRisks, ...report.pathDecision.riskFlags].map(
    (item) => `${item.code} ${item.message}`.toUpperCase()
  );
  const actions = report.actionPriorities.map((item) =>
    `${item.code} ${item.title}`.toUpperCase()
  );
  const riskRecall = recall(expectation.expectedTopRisks, risks, riskMap);
  const actionPriorityRecall = recall(
    expectation.expectedActionPriorities,
    actions,
    actionMap
  );
  const actual = new Map(
    report.schoolRecommendations.map((item) => [item.programId, item.tier])
  );
  const schoolTierMatches = expectation.schoolExpectations.map((item) => {
    const found = item.programId ? actual.get(item.programId) : undefined;
    if (!found) {
      return { expected: item.expectedTier, status: "MISSING" as const };
    }
    const normalizedExpected =
      item.expectedTier === "SAFE"
        ? normalizeSchoolMatchTier(item.expectedTier)
        : item.expectedTier;
    if (normalizedExpected === found) {
      return {
        actual: found,
        expected: item.expectedTier,
        status: "MATCH" as const,
      };
    }
    return {
      actual: found,
      expected: item.expectedTier,
      status:
        item.expectedTier === "EXCLUDE" ||
        item.expectedTier === "SAFE" ||
        item.expectedTier === "CONSERVATIVE"
          ? ("TOO_AGGRESSIVE" as const)
          : ("TOO_CONSERVATIVE" as const),
    };
  });
  return {
    actionPriorityRecall,
    missingExpectedSchools: schoolTierMatches
      .filter((item) => item.status === "MISSING")
      .map((item) => item.expected),
    pathMatch: report.pathDecision.path === expectation.expectedPath,
    postgraduateScoreMatch: score(
      report.postgraduateExamScore.total,
      expectation.postgraduateScoreRange
    ),
    recommendationScoreMatch: score(
      report.recommendationScore.total,
      expectation.recommendationScoreRange
    ),
    riskRecall,
    schoolTierMatches,
    unexpectedSchools: report.schoolRecommendations
      .filter(
        (item) =>
          !expectation.schoolExpectations.some(
            (expected) => expected.programId === item.programId
          )
      )
      .map((item) => item.programId),
  };
}
function score(value: number, range?: { min: number; max: number }) {
  if (!range) {
    return;
  }
  return {
    difference:
      value < range.min
        ? value - range.min
        : value > range.max
          ? value - range.max
          : 0,
    status:
      value < range.min
        ? ("LOW" as const)
        : value > range.max
          ? ("HIGH" as const)
          : ("PASS" as const),
  };
}
function recall(
  expected: readonly string[],
  actual: string[],
  map: Record<string, string[]>
) {
  if (!expected.length) {
    return 1;
  }
  return (
    expected.filter((item) =>
      (map[item] ?? []).some((token) =>
        actual.some((value) => value.includes(token))
      )
    ).length / expected.length
  );
}
