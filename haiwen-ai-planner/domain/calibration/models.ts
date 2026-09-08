import { z } from "zod";
import { studentProfileSchema } from "@/domain/student/schema";

export const calibrationVersion = "calibration-harness-v0.1" as const;
const range = z
  .object({ max: z.number().min(0).max(100), min: z.number().min(0).max(100) })
  .refine((value) => value.min <= value.max, "min must not exceed max");
export const riskTaxonomySchema = z.enum([
  "ranking",
  "english",
  "research",
  "competition",
  "target-fit",
  "policy",
  "timing",
  "profile-completeness",
]);
export const actionTaxonomySchema = z.enum([
  "IMPROVE_RANKING",
  "IMPROVE_ENGLISH",
  "BUILD_RESEARCH",
  "STRENGTHEN_COMPETITION",
  "CLARIFY_TARGET",
  "START_EXAM_PREP",
  "VERIFY_POLICY",
  "OTHER",
]);
export const schoolExpectationSchema = z
  .object({
    expectedTier: z.enum([
      "STRETCH",
      "MATCH",
      "CONSERVATIVE",
      "SAFE",
      "EXCLUDE",
      "UNKNOWN",
    ]),
    programId: z.string().min(1).optional(),
    universityName: z.string().min(1).optional(),
  })
  .refine(
    (value) => value.programId || value.universityName,
    "programId or universityName is required"
  );
export const expertExpectationSchema = z.object({
  expectationSource: z.enum(["SYNTHETIC_TEST", "EXPERT_REVIEW"]),
  expectedActionPriorities: z.array(actionTaxonomySchema).default([]),
  expectedMissingData: z.array(riskTaxonomySchema).default([]),
  expectedPath: z.enum([
    "RECOMMENDATION",
    "POSTGRAD_EXAM",
    "DUAL_TRACK",
    "INSUFFICIENT_DATA",
  ]),
  expectedTopRisks: z.array(riskTaxonomySchema).default([]),
  postgraduateScoreRange: range.optional(),
  recommendationScoreRange: range.optional(),
  reviewedAt: z.string().optional(),
  reviewerNotes: z.string().optional(),
  reviewerRole: z.string().optional(),
  schoolExpectations: z.array(schoolExpectationSchema).default([]),
});
export const calibrationCaseSchema = z.object({
  admissionYear: z.number().int(),
  caseId: z.string().min(1),
  expertExpectation: expertExpectationSchema,
  notes: z.string().optional(),
  profile: studentProfileSchema,
  title: z.string().min(1),
});
export const expertReviewSubmissionSchema = z.object({
  reviews: z
    .array(
      z.object({
        caseId: z.string().min(1),
        expertExpectation: expertExpectationSchema.refine(
          (expectation) => expectation.expectationSource === "EXPERT_REVIEW",
          "expectationSource must be EXPERT_REVIEW"
        ),
      })
    )
    .min(1),
});
export type CalibrationCase = z.output<typeof calibrationCaseSchema>;
export type CalibrationComparison = {
  pathMatch: boolean;
  recommendationScoreMatch?: {
    status: "PASS" | "LOW" | "HIGH";
    difference: number;
  };
  postgraduateScoreMatch?: {
    status: "PASS" | "LOW" | "HIGH";
    difference: number;
  };
  riskRecall: number;
  schoolTierMatches: {
    expected: string;
    actual?: string;
    status:
      | "MATCH"
      | "TOO_AGGRESSIVE"
      | "TOO_CONSERVATIVE"
      | "MISSING"
      | "UNEXPECTED";
  }[];
  unexpectedSchools: string[];
  missingExpectedSchools: string[];
  actionPriorityRecall: number;
};
export type CalibrationCaseResult = {
  caseId: string;
  modelVersions: {
    recommendationVersion: string;
    postgraduateVersion: string;
    pathRouterVersion: string;
    schoolMatchingVersion: string;
    reportVersion: string;
  };
  expertExpectation: CalibrationCase["expertExpectation"];
  systemResult: {
    path: string;
    recommendationScore: number;
    postgraduateScore: number;
    risks: string[];
    actionPriorities: string[];
    schools: { programId: string; tier: string }[];
  };
  comparison: CalibrationComparison;
};
export type CalibrationReport = {
  version: typeof calibrationVersion;
  generatedAt: string;
  caseCount: number;
  pathAccuracy: number;
  recommendationScoreInRangeRate: number;
  postgraduateScoreInRangeRate: number;
  averageRiskRecall: number;
  schoolTierAgreement: number;
  actionPriorityRecall: number;
  failures: string[];
  cases: CalibrationCaseResult[];
};
