import { chooseStudyPath } from "@/domain/assessment/path-router";
import { calculatePostgraduateExamScore } from "@/domain/scoring/postgraduate";
import { calculateRecommendationScore } from "@/domain/scoring/recommendation";
import { evaluateProfileCompleteness } from "@/domain/student/completeness";
import { studentProfileSchema } from "@/domain/student/schema";
import type { HaiwenGraphStateType, HaiwenGraphUpdate } from "../state";

export function profileValidation(
  state: HaiwenGraphStateType
): HaiwenGraphUpdate {
  const parsed = studentProfileSchema.safeParse(state.studentProfile ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message);
    return {
      errors: issues.map((message) => ({
        code: "PROFILE_VALIDATION_FAILED",
        message,
        node: "profile_validation",
      })),
      validationResult: { completeness: null, issues, valid: false },
    };
  }
  const completeness = evaluateProfileCompleteness(parsed.data);
  return {
    studentProfile: parsed.data,
    validationResult: { completeness, issues: [], valid: true },
  };
}

export function scoring(state: HaiwenGraphStateType): HaiwenGraphUpdate {
  const parsed = studentProfileSchema.safeParse(state.studentProfile);
  if (!parsed.success || !state.validationResult?.valid) {
    return {
      errors: [
        {
          code: "SCORING_SKIPPED_INVALID_PROFILE",
          message: "Scoring requires a valid student profile",
          node: "scoring",
        },
      ],
    };
  }
  return {
    scores: {
      postgraduateExam: calculatePostgraduateExamScore(parsed.data),
      recommendation: calculateRecommendationScore(parsed.data),
    },
  };
}

export function pathRouter(state: HaiwenGraphStateType): HaiwenGraphUpdate {
  const parsed = studentProfileSchema.safeParse(state.studentProfile);
  const completeness = state.validationResult?.completeness;
  if (!(parsed.success && completeness && state.scores)) {
    return {
      errors: [
        {
          code: "PATH_ROUTING_SKIPPED_MISSING_SCORES",
          message: "Path routing requires a valid profile and both scores",
          node: "path_router",
        },
      ],
    };
  }
  return {
    pathDecision: chooseStudyPath({
      completeness,
      postgraduateExamScore: state.scores.postgraduateExam,
      profile: parsed.data,
      recommendationScore: state.scores.recommendation,
    }),
  };
}
