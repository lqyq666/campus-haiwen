import { describe, expect, it } from "vitest";
import { createAssessmentResult } from "../assessment/result";
import { parseStudentProfile } from "../student/schema";
import { scoringFixtures } from "./fixtures";
import { calculatePostgraduateExamScore } from "./postgraduate";
import { calculateRecommendationScore } from "./recommendation";

describe("scoring v0.1", () => {
  it("produces expected paths for representative fixtures", () => {
    const generatedAt = new Date("2026-01-01T00:00:00.000Z");
    const strong = createAssessmentResult(
      scoringFixtures.strongSophomore,
      generatedAt
    );
    const weak = createAssessmentResult(
      scoringFixtures.weakJunior,
      generatedAt
    );
    const dual = createAssessmentResult(
      scoringFixtures.dualTrackSophomore,
      generatedAt
    );
    const incomplete = createAssessmentResult(
      scoringFixtures.incompleteProfile,
      generatedAt
    );

    expect(strong.recommendationScore.total).toBeGreaterThanOrEqual(80);
    expect(strong.pathDecision.path).toBe("RECOMMENDATION");
    expect(weak.pathDecision.path).toBe("POSTGRAD_EXAM");
    expect(dual.pathDecision.path).toBe("DUAL_TRACK");
    expect(incomplete.pathDecision.path).toBe("INSUFFICIENT_DATA");
  });

  it.each([
    [5, 92],
    [10, 82],
    [20, 62],
  ])("keeps rank boundary %s at score %s", (rankPercentile, expected) => {
    const profile = parseStudentProfile({ grade: "JUNIOR", rankPercentile });
    expect(calculateRecommendationScore(profile).dimensions.academics).toBe(
      expected
    );
  });

  it.each([
    [550, 100],
    [520, 90],
    [500, 82],
    [425, 68],
  ])("keeps CET6 boundary %s at score %s", (cet6Score, expected) => {
    const profile = parseStudentProfile({ cet6Score, grade: "JUNIOR" });
    expect(calculateRecommendationScore(profile).dimensions.english).toBe(
      expected
    );
  });

  it("is deterministic for identical input", () => {
    const first = calculateRecommendationScore(scoringFixtures.boundaryProfile);
    const second = calculateRecommendationScore(
      scoringFixtures.boundaryProfile
    );
    expect(second).toEqual(first);
  });

  it("does not change scores or path from the CDUT college identity field", () => {
    const base = scoringFixtures.dualTrackSophomore;
    const generatedAt = new Date("2026-08-30T00:00:00.000Z");
    const withoutCollege = createAssessmentResult(
      parseStudentProfile({ ...base, school: "成都理工大学" }),
      generatedAt
    );
    const withCollege = createAssessmentResult(
      parseStudentProfile({
        ...base,
        college: "计算机与网络安全学院",
        school: "成都理工大学",
      }),
      generatedAt
    );
    expect(withCollege.recommendationScore).toEqual(
      withoutCollege.recommendationScore
    );
    expect(withCollege.postgraduateExamScore).toEqual(
      withoutCollege.postgraduateExamScore
    );
    expect(withCollege.pathDecision).toEqual(withoutCollege.pathDecision);
  });

  it("keeps every score finite and inside 0-100", () => {
    for (const profile of Object.values(scoringFixtures)) {
      const results = [
        calculateRecommendationScore(profile),
        calculatePostgraduateExamScore(profile),
      ];
      for (const result of results) {
        const values = [
          result.total,
          result.confidence,
          ...Object.values(result.dimensions),
        ];
        expect(values.every(Number.isFinite)).toBe(true);
        expect(values.every((value) => value >= 0 && value <= 100)).toBe(true);
      }
    }
  });

  it("explains unchanged totals with versioned contribution traces", () => {
    const results = [
      calculateRecommendationScore(scoringFixtures.boundaryProfile),
      calculatePostgraduateExamScore(scoringFixtures.boundaryProfile),
    ];

    for (const result of results) {
      expect(result.rulesVersion).toBe("rules-v0.2");
      expect(result.rulesSemanticsVersion).toBe("rules-v0.1-compatible");
      expect(result.bandStatus).toBe("PROVISIONAL");
      expect(["LOW", "MEDIUM", "MEDIUM_HIGH", "HIGH"]).toContain(result.band);
      expect(result.contributions.length).toBe(
        Object.keys(result.dimensions).length
      );
      expect(
        result.contributions.reduce((sum, item) => sum + item.points, 0)
      ).toBeCloseTo(result.total, 2);
      expect(
        result.contributions.every(
          (item) =>
            item.reasonCode && item.ruleId && item.sourceFields.length > 0
        )
      ).toBe(true);
    }
  });

  it("returns a backward-compatible path decision trace", () => {
    const complete = createAssessmentResult(
      scoringFixtures.strongSophomore
    ).pathDecision;
    expect(complete.selectedPath).toBe(complete.path);
    expect(complete.rulesVersion).toBe("rules-v0.2");
    expect(complete.triggeredRules).toEqual(
      complete.reasons.map((reason) => reason.code)
    );
    expect(complete.decisionReasonCodes).toEqual(complete.triggeredRules);
    expect(complete.positiveFactors.length).toBeGreaterThan(0);
    expect(complete.alternativePaths).not.toContain(complete.path);

    const incomplete = createAssessmentResult(
      scoringFixtures.incompleteProfile
    ).pathDecision;
    expect(incomplete.path).toBe("INSUFFICIENT_DATA");
    expect(incomplete.missingCriticalData).toEqual(incomplete.missingData);
    expect(incomplete.missingCriticalData.length).toBeGreaterThan(0);
  });
});
