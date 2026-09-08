import { z } from "zod";

const rangeSchema = z
  .object({
    max: z.number().min(0).max(100),
    min: z.number().min(0).max(100),
  })
  .strict()
  .refine((range) => range.min <= range.max, "min must not exceed max");

export const reviewerRegistrationSchema = z
  .object({
    experienceLevel: z.string().trim().min(1).max(64),
    reviewerCode: z.string().trim().min(3).max(64),
    roleType: z.enum(["PLANNING_EXPERT", "CONSULTANT", "SALES_OR_OPERATIONS"]),
  })
  .strict();

export const expertJudgmentSchema = z
  .object({
    decisionChangeConditions: z.string().trim().min(1).max(2000),
    examScoreRange: rangeSchema.optional(),
    missingInformation: z.array(z.string().trim().min(1).max(128)).default([]),
    notes: z.string().trim().max(4000).optional(),
    path: z.enum([
      "RECOMMENDATION",
      "POSTGRAD_EXAM",
      "DUAL_TRACK",
      "INSUFFICIENT_DATA",
    ]),
    recommendationScoreRange: rangeSchema.optional(),
    schoolTiers: z
      .array(
        z
          .object({
            programId: z.string().trim().min(1).max(256),
            tier: z.enum([
              "STRETCH",
              "MATCH",
              "CONSERVATIVE",
              "INSUFFICIENT_DATA",
              "EXCLUDE",
              "UNKNOWN",
            ]),
          })
          .strict()
      )
      .default([]),
    topActions: z.array(z.string().trim().min(1).max(128)).default([]),
    topRisks: z.array(z.string().trim().min(1).max(128)).default([]),
  })
  .strict();

export const expertReviewSubmissionV02Schema = z
  .object({
    caseId: z.string().trim().min(1).max(256),
    judgment: expertJudgmentSchema,
    reviewerCode: z.string().trim().min(3).max(64),
  })
  .strict();

export const ruleCandidateProposalSchema = z
  .object({
    disagreementIds: z.array(z.string().trim().min(1).max(256)).min(1),
    proposal: z
      .record(z.string(), z.unknown())
      .refine(
        (proposal) => Object.keys(proposal).length > 0,
        "proposal must not be empty"
      ),
  })
  .strict();

export const ruleCandidateStatusSchema = z
  .object({
    id: z.string().trim().min(1).max(256),
    status: z.enum(["REVIEWED", "APPROVED", "REJECTED"]),
  })
  .strict();
