import { describe, expect, it } from "vitest";
import { compareCalibrationResult } from "./compare";
import { calibrationCaseSchema } from "./models";

describe("calibration harness", () => {
  const caseItem = calibrationCaseSchema.parse({
    admissionYear: 2026,
    caseId: "case",
    expertExpectation: {
      expectationSource: "SYNTHETIC_TEST",
      expectedActionPriorities: ["IMPROVE_ENGLISH"],
      expectedPath: "POSTGRAD_EXAM",
      expectedTopRisks: ["english"],
      postgraduateScoreRange: { max: 50, min: 30 },
      recommendationScoreRange: { max: 70, min: 60 },
      schoolExpectations: [{ expectedTier: "MATCH", programId: "p1" }],
    },
    profile: { targetCities: [], targetMajors: [], targetUniversities: [] },
    title: "case",
  });
  const report = {
    actionPriorities: [{ code: "IMPROVE_ENGLISH", title: "英语" }],
    pathDecision: { path: "POSTGRAD_EXAM", riskFlags: [] },
    postgraduateExamScore: { total: 40 },
    recommendationScore: { total: 75 },
    schoolRecommendations: [{ programId: "p1", tier: "MATCH" }],
    topRisks: [{ code: "ENGLISH_REQUIREMENT_UNKNOWN", message: "英语" }],
  } as never;
  it("validates case shape and compares ranges, path, risks, schools and actions", () => {
    const result = compareCalibrationResult(caseItem, report);
    expect(result.pathMatch).toBe(true);
    expect(result.recommendationScoreMatch?.status).toBe("HIGH");
    expect(result.postgraduateScoreMatch?.status).toBe("PASS");
    expect(result.riskRecall).toBe(1);
    expect(result.schoolTierMatches[0]?.status).toBe("MATCH");
    expect(result.actionPriorityRecall).toBe(1);
  });
});
