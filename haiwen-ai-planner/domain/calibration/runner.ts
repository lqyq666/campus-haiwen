import { createHaiwenGraph } from "@/agent/graph";
import { assessmentScoringVersion } from "@/domain/assessment/result";
import { InMemoryRetrievalRepository } from "@/domain/retrieval/in-memory-repository";
import {
  InMemoryEvidenceRepository,
  InMemorySchoolRepository,
} from "@/domain/school/in-memory-repository";
import { compareCalibrationResult } from "./compare";
import {
  type CalibrationCase,
  type CalibrationCaseResult,
  type CalibrationReport,
  calibrationVersion,
} from "./models";

export async function runCalibrationCase(
  caseItem: CalibrationCase
): Promise<CalibrationCaseResult> {
  const graph = createHaiwenGraph({
    evidenceRepository: new InMemoryEvidenceRepository(),
    retrievalRepository: new InMemoryRetrievalRepository(),
    schoolRepository: new InMemorySchoolRepository(),
  });
  const result = await graph.invoke({
    admissionYear: caseItem.admissionYear,
    errors: [],
    evidence: [],
    evidencePack: null,
    generatedNarrative: null,
    leadContact: null,
    leadEvents: [],
    leadHandoffContext: null,
    leadScore: null,
    modelMetadata: null,
    pathDecision: null,
    recommendations: [],
    report: null,
    retrievalMode: null,
    retrievalQuery: null,
    retrievedChunks: [],
    roadmap: [],
    schoolCandidates: [],
    schoolMatches: [],
    scores: null,
    studentProfile: caseItem.profile,
    validationResult: null,
    warnings: [],
  });
  if (!result.report || !result.scores || !result.pathDecision) {
    throw new Error(
      `Calibration case ${caseItem.caseId} did not produce a report`
    );
  }
  return {
    caseId: caseItem.caseId,
    comparison: compareCalibrationResult(caseItem, result.report),
    expertExpectation: caseItem.expertExpectation,
    modelVersions: {
      pathRouterVersion: assessmentScoringVersion.pathRouter,
      postgraduateVersion: assessmentScoringVersion.postgraduateExam,
      recommendationVersion: assessmentScoringVersion.recommendation,
      reportVersion: result.report.reportVersion,
      schoolMatchingVersion:
        result.report.schoolRecommendations[0]?.scoringVersion ??
        "school-matching-v0.1",
    },
    systemResult: {
      actionPriorities: result.report.actionPriorities.map((item) => item.code),
      path: result.pathDecision.path,
      postgraduateScore: result.scores.postgraduateExam.total,
      recommendationScore: result.scores.recommendation.total,
      risks: result.report.topRisks.map((risk) => risk.code),
      schools: result.report.schoolRecommendations.map((item) => ({
        programId: item.programId,
        tier: item.tier,
      })),
    },
  };
}
export function aggregateCalibration(
  results: CalibrationCaseResult[]
): CalibrationReport {
  const n = results.length || 1;
  const scores = (key: "recommendationScoreMatch" | "postgraduateScoreMatch") =>
    results.filter((item) => item.comparison[key]?.status === "PASS").length /
    n;
  const tiers = results.flatMap((item) => item.comparison.schoolTierMatches);
  return {
    actionPriorityRecall:
      results.reduce(
        (sum, item) => sum + item.comparison.actionPriorityRecall,
        0
      ) / n,
    averageRiskRecall:
      results.reduce((sum, item) => sum + item.comparison.riskRecall, 0) / n,
    caseCount: results.length,
    cases: results,
    failures: results
      .filter(
        (item) => !item.comparison.pathMatch || item.comparison.riskRecall < 1
      )
      .map((item) => item.caseId),
    generatedAt: new Date().toISOString(),
    pathAccuracy:
      results.filter((item) => item.comparison.pathMatch).length / n,
    postgraduateScoreInRangeRate: scores("postgraduateScoreMatch"),
    recommendationScoreInRangeRate: scores("recommendationScoreMatch"),
    schoolTierAgreement: tiers.length
      ? tiers.filter((item) => item.status === "MATCH").length / tiers.length
      : 1,
    version: calibrationVersion,
  };
}
