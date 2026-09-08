import { describe, expect, it } from "vitest";
import { parseStudentProfile } from "@/domain/student/schema";
import {
  CalibrationWorkbench,
  calculateInterExpertAgreement,
  createRuleCandidate,
  type ExpertReview,
  InMemoryCalibrationRepository,
} from "./workbench";

const calibrationCase = {
  caseCode: "case-strong-001",
  createdAt: "2026-08-30T00:00:00.000Z",
  id: "case-1",
  sourceType: "SYNTHETIC_TEST" as const,
  status: "READY" as const,
  studentProfileSnapshot: parseStudentProfile({
    cet6Score: 530,
    cohortSize: 100,
    grade: "SOPHOMORE",
    rank: 5,
  }),
};
const prediction = {
  actionPriorities: ["VERIFY_POLICY"],
  createdAt: "2026-08-30T00:00:00.000Z",
  examScore: 68,
  id: "prediction-1",
  modelVersions: { assessment: "assessment-v0.2" },
  path: "RECOMMENDATION" as const,
  recommendationScore: 82,
  risks: ["policy"],
  schoolTiers: [{ programId: "program-1", tier: "MATCH" as const }],
};

describe("CalibrationWorkbench blind review", () => {
  it("hides prediction until an immutable expert answer is submitted", async () => {
    const repository = new InMemoryCalibrationRepository({
      cases: [calibrationCase],
      predictions: [{ ...prediction, caseId: calibrationCase.id }],
    });
    const workbench = new CalibrationWorkbench(
      repository,
      () => new Date("2026-08-30T01:00:00.000Z")
    );

    const opened = await workbench.openCase(calibrationCase.id, {
      experienceLevel: "SENIOR",
      reviewerCode: "expert-a",
      roleType: "PLANNING_EXPERT",
    });
    expect(opened).toEqual({
      case: calibrationCase,
      reviewStatus: "NOT_STARTED",
    });
    expect("systemPrediction" in opened).toBe(false);

    const review = await workbench.submitReview({
      caseId: calibrationCase.id,
      judgment: {
        decisionChangeConditions: "若排名跌出前 15%，改为双轨。",
        examScoreRange: { max: 75, min: 60 },
        missingInformation: [],
        notes: "独立判断",
        path: "DUAL_TRACK",
        recommendationScoreRange: { max: 85, min: 75 },
        schoolTiers: [{ programId: "program-1", tier: "MATCH" }],
        topActions: ["VERIFY_POLICY"],
        topRisks: ["policy"],
      },
      reviewerCode: "expert-a",
    });
    expect(review.lockedAt).toBe("2026-08-30T01:00:00.000Z");
    await expect(
      workbench.submitReview({
        caseId: calibrationCase.id,
        judgment: review.judgment,
        reviewerCode: "expert-a",
      })
    ).rejects.toThrow("EXPERT_REVIEW_LOCKED");

    const revealed = await workbench.revealReview(review.id, "expert-a");
    expect(revealed.systemPrediction).toEqual({
      ...prediction,
      caseId: calibrationCase.id,
    });
    expect(revealed.disagreements.map((item) => item.type)).toContain("PATH");
  });
});

it("creates rule candidates as proposals without activating rules", () => {
  const candidate = createRuleCandidate({
    disagreementIds: ["disagreement-1", "disagreement-1"],
    id: "candidate-1",
    now: new Date("2026-08-30T00:00:00.000Z"),
    proposal: { rationale: "专家一致指出英语门槛解释不足" },
  });
  expect(candidate.status).toBe("PROPOSED");
  expect(candidate.disagreementIds).toEqual(["disagreement-1"]);
  expect(candidate.proposal).not.toHaveProperty("active");
});

describe("inter-expert agreement", () => {
  it("distinguishes complete, partial, and zero path agreement", () => {
    const reviews = (paths: ExpertReview["judgment"]["path"][]) =>
      paths.map(
        (path, index): ExpertReview => ({
          caseId: "case-1",
          id: `review-${index}`,
          judgment: {
            decisionChangeConditions: "条件变化",
            missingInformation: [],
            path,
            schoolTiers: [],
            topActions: [],
            topRisks: [],
          },
          lockedAt: "2026-08-30T00:00:00.000Z",
          reviewerId: `reviewer-${index}`,
          submittedAt: "2026-08-30T00:00:00.000Z",
        })
      );

    expect(
      calculateInterExpertAgreement(
        reviews(["DUAL_TRACK", "DUAL_TRACK", "DUAL_TRACK"])
      )
    ).toBe(1);
    expect(
      calculateInterExpertAgreement(
        reviews(["DUAL_TRACK", "DUAL_TRACK", "POSTGRAD_EXAM"])
      )
    ).toBeCloseTo(1 / 3);
    expect(
      calculateInterExpertAgreement(
        reviews(["DUAL_TRACK", "POSTGRAD_EXAM", "RECOMMENDATION"])
      )
    ).toBe(0);
  });
});
