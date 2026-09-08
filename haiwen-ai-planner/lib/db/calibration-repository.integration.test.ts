import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CalibrationWorkbench } from "@/domain/calibration/workbench";
import { parseStudentProfile } from "@/domain/student/schema";
import { PostgresCalibrationRepository } from "./calibration-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

integration("PostgreSQL calibration workbench", () => {
  const sql = postgres(databaseUrl ?? "postgresql://invalid");
  const repository = new PostgresCalibrationRepository(sql);
  const now = () => new Date("2026-08-30T00:00:00.000Z");
  const workbench = new CalibrationWorkbench(repository, now);

  beforeAll(async () => {
    await sql`TRUNCATE calibration_disagreements, expert_reviews, system_prediction_snapshots, expert_reviewers, calibration_cases CASCADE`;
    await repository.upsertCase({
      caseCode: "integration-case",
      createdAt: now().toISOString(),
      id: "calibration-case:integration",
      sourceType: "SYNTHETIC_TEST",
      status: "READY",
      studentProfileSnapshot: parseStudentProfile({
        cohortSize: 100,
        grade: "SOPHOMORE",
        rank: 10,
        targetMajors: ["计算机"],
      }),
    });
    await repository.upsertPrediction({
      actionPriorities: ["补齐英语信息"],
      caseId: "calibration-case:integration",
      createdAt: now().toISOString(),
      examScore: 60,
      id: "prediction:integration",
      modelVersions: { rules: "rules-v0.2" },
      path: "DUAL_TRACK",
      recommendationScore: 65,
      risks: ["英语信息不足"],
      schoolTiers: [],
    });
  });

  afterAll(async () => {
    await sql.end();
  });

  it("keeps the prediction blind, locks the answer, then reveals", async () => {
    const opened = await workbench.openCase("calibration-case:integration", {
      experienceLevel: "SENIOR",
      reviewerCode: "expert-integration",
      roleType: "PLANNING_EXPERT",
    });
    expect(opened).not.toHaveProperty("systemPrediction");
    const review = await workbench.submitReview({
      caseId: "calibration-case:integration",
      judgment: {
        decisionChangeConditions: "排名显著变化",
        examScoreRange: { max: 70, min: 55 },
        missingInformation: [],
        path: "DUAL_TRACK",
        recommendationScoreRange: { max: 70, min: 60 },
        schoolTiers: [],
        topActions: ["补齐英语信息"],
        topRisks: ["英语信息不足"],
      },
      reviewerCode: "expert-integration",
    });
    await expect(
      sql`UPDATE expert_reviews SET judgment='{}'::jsonb WHERE id=${review.id}`
    ).rejects.toThrow();
    const revealed = await workbench.revealReview(
      review.id,
      "expert-integration"
    );
    expect(revealed.systemPrediction.path).toBe("DUAL_TRACK");
    expect(revealed.expertReview.revealedAt).toBe(now().toISOString());
  });
});
