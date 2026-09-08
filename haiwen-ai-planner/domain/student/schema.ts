import { z } from "zod";

export const gradeSchema = z.enum([
  "FRESHMAN",
  "SOPHOMORE",
  "JUNIOR",
  "SENIOR",
  "GRADUATED",
]);

export const competitionLevelSchema = z.enum([
  "UNIVERSITY",
  "PROVINCIAL",
  "NATIONAL",
  "INTERNATIONAL",
]);

export const englishTestStatusSchema = z.enum([
  "NOT_TAKEN",
  "TAKEN_UNKNOWN",
  "PASSED",
  "FAILED",
  "UNKNOWN",
]);

const trimmedOptionalString = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const trimmedStringArray = z
  .array(z.string().trim().min(1))
  .default([])
  .transform((values) => [...new Set(values)]);

const optionalStringArray = z
  .array(z.string().trim().min(1))
  .default([])
  .transform((values) => [...new Set(values)]);

const relevanceSchema = z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]);

export const researchExperienceSchema = z.object({
  description: trimmedOptionalString,
  direction: trimmedOptionalString,
  durationMonths: z.number().int().min(0).max(120).optional(),
  id: trimmedOptionalString,
  isRepresentative: z.boolean().optional(),
  output: trimmedOptionalString,
  outputDescription: trimmedOptionalString,
  outputLevel: trimmedOptionalString,
  outputType: trimmedOptionalString,
  relevanceToTarget: relevanceSchema.optional(),
  role: z.enum(["LEAD", "CORE", "PARTICIPANT", "UNKNOWN"]).default("UNKNOWN"),
  title: z.string().trim().min(1),
});

export const competitionExperienceSchema = z.object({
  award: z.string().trim().min(1),
  awardLevel: trimmedOptionalString,
  category: trimmedOptionalString,
  description: trimmedOptionalString,
  level: competitionLevelSchema,
  name: z.string().trim().min(1),
  relevanceToTarget: relevanceSchema.optional(),
  role: trimmedOptionalString,
  teamOrIndividual: z.enum(["TEAM", "INDIVIDUAL", "UNKNOWN"]).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
});

export const paperExperienceSchema = z.object({
  authorship: z.enum(["FIRST", "CO_FIRST", "OTHER"]).default("OTHER"),
  status: z.enum(["DRAFT", "SUBMITTED", "ACCEPTED", "PUBLISHED"]),
  title: z.string().trim().min(1),
});

export const internshipExperienceSchema = z.object({
  description: trimmedOptionalString,
  durationMonths: z.number().int().min(0).max(60).optional(),
  organization: z.string().trim().min(1),
  relevance: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  relevanceToTarget: relevanceSchema.optional(),
  role: z.string().trim().min(1),
});

export const projectExperienceSchema = z.object({
  description: trimmedOptionalString,
  durationMonths: z.number().int().min(0).max(120).optional(),
  name: z.string().trim().min(1),
  relevanceToTarget: relevanceSchema.optional(),
  role: trimmedOptionalString,
});

export const openSourceExperienceSchema = z.object({
  description: trimmedOptionalString,
  name: z.string().trim().min(1),
  relevanceToTarget: relevanceSchema.optional(),
  repositoryUrl: z.string().url().optional(),
  role: trimmedOptionalString,
});

export const engineeringOutputSchema = z.object({
  description: trimmedOptionalString,
  name: z.string().trim().min(1),
  outputType: trimmedOptionalString,
  relevanceToTarget: relevanceSchema.optional(),
  url: z.string().url().optional(),
});

export const timeContextSchema = z.object({
  currentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  currentStage: trimmedOptionalString,
  monthsRemaining: z.number().int().min(0).max(120).optional(),
  targetAdmissionYear: z.number().int().min(2000).max(2100).optional(),
});

const studentProfileBaseSchema = z.object({
  cet4Score: z.number().int().min(0).max(710).optional(),
  cet4Status: englishTestStatusSchema.optional(),
  cet6Score: z.number().int().min(0).max(710).optional(),
  cet6Status: englishTestStatusSchema.optional(),
  cohortSize: z.number().int().min(1).optional(),
  college: trimmedOptionalString,
  competitionExperiences: z.array(competitionExperienceSchema).default([]),
  currentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  currentStage: trimmedOptionalString,
  dailyStudyHours: z.number().min(0).max(24).optional(),
  engineeringOutputs: z.array(engineeringOutputSchema).default([]),
  englishLearningStatus: trimmedOptionalString,
  englishTarget: trimmedOptionalString,
  familyConstraint: trimmedOptionalString,
  financialConstraint: trimmedOptionalString,
  gpa: z.number().min(0).max(5).optional(),
  grade: gradeSchema.optional(),
  graduationYear: z.number().int().min(2000).max(2100).optional(),
  id: trimmedOptionalString,
  ieltsScore: z.number().min(0).max(9).optional(),
  internships: z.array(internshipExperienceSchema).default([]),
  major: trimmedOptionalString,
  monthsRemaining: z.number().int().min(0).max(120).optional(),
  openSourceExperiences: z.array(openSourceExperienceSchema).default([]),
  otherConstraints: optionalStringArray,
  papers: z.array(paperExperienceSchema).default([]),
  pathPreference: z
    .enum(["RECOMMENDATION", "POSTGRAD_EXAM", "DUAL_TRACK", "UNDECIDED"])
    .optional(),
  projects: z.array(projectExperienceSchema).default([]),
  rank: z.number().int().min(1).optional(),
  ranking: z.number().int().min(1).optional(),
  rankingTrend: z
    .enum(["IMPROVING", "STABLE", "DECLINING", "UNKNOWN"])
    .optional(),
  rankPercentile: z.number().gt(0).max(100).optional(),
  researchExperiences: z.array(researchExperienceSchema).default([]),
  riskPreference: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]).optional(),
  school: trimmedOptionalString,
  schoolCode: trimmedOptionalString,
  schoolTier: trimmedOptionalString,
  targetAdmissionYear: z.number().int().min(2000).max(2100).optional(),
  targetCities: trimmedStringArray,
  targetMajors: trimmedStringArray,
  targetProgramTypes: trimmedStringArray,
  targetSchoolLevels: trimmedStringArray,
  targetUniversities: trimmedStringArray,
  timeContext: timeContextSchema.optional(),
  toeflScore: z.number().int().min(0).max(120).optional(),
  undergraduateMajor: trimmedOptionalString,
  undergraduateUniversity: trimmedOptionalString,
  weeklyAvailableHours: z.number().min(0).max(168).optional(),
  willingToRelocate: z.boolean().optional(),
});

export const studentProfileSchema = studentProfileBaseSchema
  .superRefine((profile, context) => {
    if (
      profile.rank !== undefined &&
      profile.ranking !== undefined &&
      profile.rank !== profile.ranking
    ) {
      context.addIssue({
        code: "custom",
        message: "rank and ranking must match when both are provided",
        path: ["ranking"],
      });
    }
    const effectiveRank = profile.rank ?? profile.ranking;
    if (
      effectiveRank !== undefined &&
      profile.cohortSize !== undefined &&
      effectiveRank > profile.cohortSize
    ) {
      context.addIssue({
        code: "custom",
        message: "rank cannot exceed cohortSize",
        path: ["rank"],
      });
    }
    for (const test of ["cet4", "cet6"] as const) {
      const status = profile[`${test}Status`];
      const score = profile[`${test}Score`];
      if (status === "NOT_TAKEN" && score !== undefined) {
        context.addIssue({
          code: "custom",
          message: `${test}Score must be absent when ${test}Status is NOT_TAKEN`,
          path: [`${test}Score`],
        });
      }
    }
  })
  .transform((profile) => ({
    ...profile,
    cet4Status: profile.cet4Status ?? statusFromLegacyScore(profile.cet4Score),
    cet6Status: profile.cet6Status ?? statusFromLegacyScore(profile.cet6Score),
    currentDate: profile.currentDate ?? profile.timeContext?.currentDate,
    currentStage: profile.currentStage ?? profile.timeContext?.currentStage,
    major: profile.major ?? profile.undergraduateMajor,
    monthsRemaining:
      profile.monthsRemaining ?? profile.timeContext?.monthsRemaining,
    rank: profile.rank ?? profile.ranking,
    ranking: profile.ranking ?? profile.rank,
    rankPercentile:
      profile.rankPercentile ??
      ((profile.rank ?? profile.ranking) !== undefined &&
      profile.cohortSize !== undefined
        ? Math.round(
            (((profile.rank ?? profile.ranking) as number) /
              profile.cohortSize) *
              10_000
          ) / 100
        : undefined),
    school: profile.school ?? profile.undergraduateUniversity,
    targetAdmissionYear:
      profile.targetAdmissionYear ?? profile.timeContext?.targetAdmissionYear,
    timeContext:
      profile.timeContext ??
      (profile.currentDate !== undefined ||
      profile.currentStage !== undefined ||
      profile.monthsRemaining !== undefined ||
      profile.targetAdmissionYear !== undefined
        ? {
            currentDate: profile.currentDate,
            currentStage: profile.currentStage,
            monthsRemaining: profile.monthsRemaining,
            targetAdmissionYear: profile.targetAdmissionYear,
          }
        : undefined),
    undergraduateMajor: profile.undergraduateMajor ?? profile.major,
    undergraduateUniversity: profile.undergraduateUniversity ?? profile.school,
  }));

function statusFromLegacyScore(score: number | undefined) {
  if (score === undefined) {
    return "UNKNOWN" as const;
  }
  return score >= 425 ? ("PASSED" as const) : ("FAILED" as const);
}

export type Grade = z.infer<typeof gradeSchema>;
export type EnglishTestStatus = z.infer<typeof englishTestStatusSchema>;
export type ResearchExperience = z.infer<typeof researchExperienceSchema>;
export type CompetitionExperience = z.infer<typeof competitionExperienceSchema>;
export type PaperExperience = z.infer<typeof paperExperienceSchema>;
export type InternshipExperience = z.infer<typeof internshipExperienceSchema>;
export type ProjectExperience = z.infer<typeof projectExperienceSchema>;
export type OpenSourceExperience = z.infer<typeof openSourceExperienceSchema>;
export type EngineeringOutput = z.infer<typeof engineeringOutputSchema>;
export type TimeContext = z.infer<typeof timeContextSchema>;
export type StudentProfile = z.output<typeof studentProfileSchema>;
export type StudentProfileInput = z.input<typeof studentProfileSchema>;

export function parseStudentProfile(input: unknown): StudentProfile {
  return studentProfileSchema.parse(input);
}
