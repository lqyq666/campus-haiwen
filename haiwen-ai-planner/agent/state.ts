import { Annotation } from "@langchain/langgraph";
import type { PathDecision } from "@/domain/assessment/path-router";
import type { Evidence, SourceDocument } from "@/domain/evidence/models";
import type {
  LeadContact,
  LeadEvent,
  LeadHandoffContext,
  LeadScore,
} from "@/domain/lead/models";
import type {
  ActionPriority,
  AssessmentReport,
  SchoolMatchResult,
} from "@/domain/recommendation/models";
import type {
  GeneratedReportNarrative,
  ModelMetadata,
} from "@/domain/report/models";
import type {
  EvidencePack,
  RetrievalMode,
  RetrievalQuery,
  RetrievedChunk,
} from "@/domain/retrieval/models";
import type { CandidateProgram } from "@/domain/school/repository";
import type { PostgraduateExamScore } from "@/domain/scoring/postgraduate";
import type { RecommendationScore } from "@/domain/scoring/recommendation";
import type { ProfileCompleteness } from "@/domain/student/completeness";
import type {
  StudentProfile,
  StudentProfileInput,
} from "@/domain/student/schema";

export type HaiwenGraphError = {
  code: string;
  message: string;
  node: string;
};

export type ProfileValidationResult = {
  completeness: ProfileCompleteness | null;
  issues: string[];
  valid: boolean;
};

export type AssessmentScores = {
  postgraduateExam: PostgraduateExamScore;
  recommendation: RecommendationScore;
};

export const HaiwenGraphState = Annotation.Root({
  admissionYear: Annotation<number | null>(),
  errors: Annotation<readonly HaiwenGraphError[]>({
    default: () => [],
    reducer: (current, update) => [...current, ...update],
  }),
  evidence: Annotation<readonly Evidence[]>(),
  evidencePack: Annotation<EvidencePack | null>(),
  generatedNarrative: Annotation<GeneratedReportNarrative | null>(),
  leadContact: Annotation<LeadContact | null>(),
  leadEvents: Annotation<readonly LeadEvent[]>(),
  leadHandoffContext: Annotation<LeadHandoffContext | null>(),
  leadScore: Annotation<LeadScore | null>(),
  modelMetadata: Annotation<ModelMetadata | null>(),
  pathDecision: Annotation<PathDecision | null>(),
  recommendations: Annotation<readonly Record<string, unknown>[]>(),
  report: Annotation<AssessmentReport | null>(),
  retrievalMode: Annotation<RetrievalMode | null>(),
  retrievalQuery: Annotation<RetrievalQuery | null>(),
  retrievedChunks: Annotation<readonly RetrievedChunk[]>(),
  roadmap: Annotation<readonly ActionPriority[]>(),
  schoolCandidates: Annotation<readonly CandidateProgram[]>(),
  schoolMatches: Annotation<readonly SchoolMatchResult[]>(),
  scores: Annotation<AssessmentScores | null>(),
  sourceDocuments: Annotation<readonly SourceDocument[]>({
    default: () => [],
    reducer: (_current, update) => update,
  }),
  studentProfile: Annotation<StudentProfile | StudentProfileInput | null>(),
  validationResult: Annotation<ProfileValidationResult | null>(),
  warnings: Annotation<readonly string[]>({
    default: () => [],
    reducer: (current, update) => [...current, ...update],
  }),
});

export type HaiwenGraphStateType = typeof HaiwenGraphState.State;
export type HaiwenGraphUpdate = typeof HaiwenGraphState.Update;
