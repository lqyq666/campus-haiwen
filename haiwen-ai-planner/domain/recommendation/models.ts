import type { AssessmentResult } from "@/domain/assessment/result";
import type {
  Evidence,
  SourceDocument,
  VerifiedEvidence,
} from "@/domain/evidence/models";
import type { CandidateProgram } from "@/domain/school/repository";
import type { StudentProfile } from "@/domain/student/schema";

export type SchoolMatchTier =
  | "STRETCH"
  | "MATCH"
  | "CONSERVATIVE"
  | "INSUFFICIENT_DATA";

export type LegacySchoolMatchTier = SchoolMatchTier | "SAFE";

export function normalizeSchoolMatchTier(
  tier: LegacySchoolMatchTier
): SchoolMatchTier {
  return tier === "SAFE" ? "CONSERVATIVE" : tier;
}

export type EligibilityStatus = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";

export type SchoolMatchDimension = {
  evidenceQuality: number;
  policyFit: number;
  profileStrength: number;
  targetAlignment: number;
};

export type EvidenceCoverage = {
  admissionPolicy: boolean;
  englishRequirement: boolean;
  recommendationPolicy: boolean;
};

export type SchoolMatchReasonCode =
  | "STRONG_PROFILE"
  | "TARGET_CITY_MATCH"
  | "TARGET_MAJOR_MATCH"
  | "TARGET_UNIVERSITY_MATCH"
  | "ENGLISH_REQUIREMENT_MET"
  | "ENGLISH_REQUIREMENT_UNKNOWN"
  | "POLICY_EVIDENCE_PRESENT"
  | "LIMITED_EVIDENCE"
  | "PROFILE_DATA_INCOMPLETE";

export type SchoolMatchRiskCode =
  | "HARD_POLICY_MISMATCH"
  | "ENGLISH_REQUIREMENT_UNKNOWN"
  | "POLICY_DATA_MISSING"
  | "HISTORICAL_ADMISSION_DATA_MISSING"
  | "PROFILE_INCOMPLETE"
  | "LIMITED_EVIDENCE"
  | "ADMISSION_YEAR_MISMATCH";

export type SchoolMatchReason = {
  code: SchoolMatchReasonCode;
  message: string;
};

export type SchoolMatchRisk = {
  code: SchoolMatchRiskCode;
  message: string;
};

export type SchoolMatchResult = {
  confidence: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  dimensions: SchoolMatchDimension;
  eligibility: EligibilityStatus;
  evidenceCoverage: EvidenceCoverage;
  evidenceIds: string[];
  missingData: string[];
  matchingVersion: "program-matching-v0.2";
  positiveFactors: SchoolMatchReason[];
  programId: string;
  programName: string;
  universityId: string;
  departmentId: string;
  reasons: SchoolMatchReason[];
  riskFactors: SchoolMatchRisk[];
  riskFlags: SchoolMatchRisk[];
  rulesVersion: "rules-v0.2";
  schoolDataVersion: string;
  schoolId: string;
  score: number;
  scoringVersion: string;
  tier: SchoolMatchTier;
};

export type SchoolMatchingInput = {
  admissionYear: number;
  assessmentResult: AssessmentResult;
  candidates: readonly CandidateProgram[];
  evidence: readonly Evidence[];
  profile: StudentProfile;
  schoolDataVersion?: string;
};

export type ActionPriorityCode =
  | "IMPROVE_ENGLISH"
  | "COMPLETE_PROFILE"
  | "VERIFY_POLICY"
  | "CLARIFY_TARGETS"
  | "BUILD_EVIDENCE_BASELINE"
  | "VALIDATE_TARGET_SHORTLIST"
  | "RUN_PROGRESS_REVIEW";

export type ActionTimeWindow = "DAYS_0_30" | "DAYS_31_60" | "DAYS_61_90";

export type ActionPriority = {
  action: string;
  code: ActionPriorityCode;
  evidenceIds: string[];
  priority: number;
  relatedRisk: string | null;
  reason: string;
  successSignal: string;
  timeWindow: ActionTimeWindow;
  title: string;
  why: string;
};

export type AssessmentReport = {
  assessmentVersion: "assessment-v0.2";
  actionPriorities: ActionPriority[];
  createdAt: string;
  evidenceIndex: Record<string, VerifiedEvidence>;
  evidenceVersion: "evidence-v0.2";
  generatedAt: string;
  missingData: string[];
  pathDecision: AssessmentResult["pathDecision"];
  postgraduateExamScore: AssessmentResult["postgraduateExamScore"];
  profileCompleteness: AssessmentResult["profileCompleteness"];
  recommendationScore: AssessmentResult["recommendationScore"];
  reportVersion: "assessment-report-v0.2";
  rulesVersion: "rules-v0.2";
  schoolDataVersion: string;
  schoolRecommendations: SchoolMatchResult[];
  studentSummary: {
    grade?: StudentProfile["grade"];
    targetCities: string[];
    targetMajors: string[];
    targetUniversities: string[];
  };
  topRisks: SchoolMatchRisk[];
};

export type AssessmentReportInput = {
  actionPriorities: readonly ActionPriority[];
  admissionYear: number;
  assessmentResult: AssessmentResult;
  evidence: readonly Evidence[];
  generatedAt?: Date;
  profile: StudentProfile;
  schoolRecommendations: readonly SchoolMatchResult[];
  schoolDataVersion?: string;
  sourceDocuments: readonly SourceDocument[];
};

export type AssessmentReportValidation = {
  issues: string[];
  valid: boolean;
};
