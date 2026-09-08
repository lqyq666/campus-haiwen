import {
  type AssessmentResult,
  assessmentScoringVersion,
} from "@/domain/assessment/result";
import { matchSchoolCandidates } from "@/domain/recommendation/matching";
import {
  createActionPriorities,
  createAssessmentReport,
  validateAssessmentReport,
} from "@/domain/recommendation/report";
import { studentProfileSchema } from "@/domain/student/schema";
import type { HaiwenGraphStateType, HaiwenGraphUpdate } from "../state";

export function schoolMatching(state: HaiwenGraphStateType): HaiwenGraphUpdate {
  const profile = studentProfileSchema.safeParse(state.studentProfile);
  const assessment = assessmentResultFromState(state);
  if (
    !(profile.success && assessment && validAdmissionYear(state.admissionYear))
  ) {
    return {
      errors: [
        {
          code: "SCHOOL_MATCHING_SKIPPED_MISSING_INPUT",
          message:
            "School matching requires profile, scores, path decision, and explicit admissionYear",
          node: "school_matching",
        },
      ],
      schoolMatches: [],
    };
  }
  return {
    schoolMatches: matchSchoolCandidates({
      admissionYear: state.admissionYear,
      assessmentResult: assessment,
      candidates: state.schoolCandidates,
      evidence: state.evidence,
      profile: profile.data,
    }),
  };
}

export function roadmapGeneration(
  state: HaiwenGraphStateType
): HaiwenGraphUpdate {
  const profile = studentProfileSchema.safeParse(state.studentProfile);
  if (!profile.success) {
    return { roadmap: [] };
  }
  return { roadmap: createActionPriorities(state.schoolMatches, profile.data) };
}

export function reportContractGeneration(
  state: HaiwenGraphStateType
): HaiwenGraphUpdate {
  const profile = studentProfileSchema.safeParse(state.studentProfile);
  const assessment = assessmentResultFromState(state);
  if (
    !(profile.success && assessment && validAdmissionYear(state.admissionYear))
  ) {
    return {
      errors: [
        {
          code: "REPORT_CONTRACT_SKIPPED_MISSING_INPUT",
          message: "Report contract requires profile and assessment inputs",
          node: "report_contract_generation",
        },
      ],
    };
  }
  return {
    report: createAssessmentReport({
      actionPriorities: state.roadmap,
      admissionYear: state.admissionYear,
      assessmentResult: assessment,
      evidence: state.evidence,
      profile: profile.data,
      schoolRecommendations: state.schoolMatches,
      sourceDocuments: state.sourceDocuments,
    }),
  };
}

export function reportValidation(
  state: HaiwenGraphStateType
): HaiwenGraphUpdate {
  const validation = validateAssessmentReport(
    state.report,
    state.schoolCandidates.map((candidate) => candidate.program.id)
  );
  if (validation.valid) {
    return {};
  }
  return {
    errors: validation.issues.map((message) => ({
      code: "ASSESSMENT_REPORT_INVALID",
      message,
      node: "report_validation",
    })),
    report: null,
  };
}

function assessmentResultFromState(
  state: HaiwenGraphStateType
): AssessmentResult | undefined {
  if (
    !(
      state.scores &&
      state.pathDecision &&
      state.validationResult?.completeness
    )
  ) {
    return;
  }
  return {
    generatedAt: new Date(0).toISOString(),
    pathDecision: state.pathDecision,
    postgraduateExamScore: state.scores.postgraduateExam,
    profileCompleteness: state.validationResult.completeness,
    recommendationScore: state.scores.recommendation,
    scoringVersion: assessmentScoringVersion,
  };
}

function validAdmissionYear(value: number | null): value is number {
  return (
    value !== null && Number.isInteger(value) && value >= 2000 && value <= 2100
  );
}
