import type { AssessmentReport } from "@/domain/recommendation/models";
import type { StudentProfile } from "@/domain/student/schema";

export type LeadStatus =
  | "NEW"
  | "NURTURING"
  | "QUALIFIED"
  | "READY_FOR_CONSULTANT"
  | "CONTACTED"
  | "CONVERTED"
  | "CLOSED_LOST";
export type LeadSource =
  | "ASSESSMENT"
  | "CHAT"
  | "REPORT"
  | "REFERRAL"
  | "OTHER";
export type ContactMethod = "PHONE" | "WECHAT" | "QQ" | "EMAIL";
export type LeadEventType =
  | "ASSESSMENT_STARTED"
  | "ASSESSMENT_COMPLETED"
  | "REPORT_VIEWED"
  | "AI_REPORT_GENERATED"
  | "CONTACT_SUBMITTED"
  | "SCHOOL_RECOMMENDATION_VIEWED"
  | "EVIDENCE_VIEWED"
  | "ROADMAP_VIEWED"
  | "REQUESTED_CONSULTATION"
  | "CHAT_STARTED"
  | "CHAT_MESSAGE_SENT"
  | "RETURN_VISIT";
export type LeadQualification = "LOW" | "NURTURE" | "QUALIFIED" | "HOT";
export type LeadPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type Lead = {
  assessmentId?: string;
  createdAt: string;
  id: string;
  source: LeadSource;
  status: LeadStatus;
  studentProfileId?: string;
  updatedAt: string;
};
export type LeadContact = {
  contactable: boolean;
  consentToContact: boolean;
  consentAt?: string;
  consentVersion: "contact-consent-v0.2";
  createdAt: string;
  email?: string;
  leadId: string;
  name?: string;
  phone?: string;
  qq?: string;
  preferredContactMethod?: ContactMethod;
  updatedAt: string;
  wechat?: string;
};
export type LeadEvent = {
  eventKey?: string;
  id: string;
  leadId: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  type: LeadEventType;
};
export type LeadScore = {
  calculatedAt: string;
  fitScore: number;
  fitReasons: string[];
  intentScore: number;
  intentReasons: string[];
  priority: LeadPriority;
  qualification: LeadQualification;
  reasons: string[];
  riskFlags: string[];
  total: number;
  urgencyReasons: string[];
  urgencyScore: number;
  version: "lead-score-v0.2";
};
export type ConsultationContext = {
  advisorHelp?: string;
  attemptedAction?: string;
  biggestWorry?: string;
  currentConcern?: string;
  decisionDeadline?: string;
  next30DayGoal?: string;
  requestedReview: boolean;
  sevenDayAction?: string;
  specificBlocker?: string;
};
export type LeadHandoffContext = {
  actionsAlreadyRecommended: AssessmentReport["actionPriorities"];
  advisorSummary?: string;
  consultationContext: ConsultationContext;
  doNotPromise: string[];
  leadId: string;
  leadScore: LeadScore;
  missingInformation: string[];
  postgraduateExamScore: AssessmentReport["postgraduateExamScore"];
  recommendationScore: AssessmentReport["recommendationScore"];
  recommendedConversationTopics: string[];
  recommendedOpening: string;
  recommendedPath: string;
  schoolRecommendations: AssessmentReport["schoolRecommendations"];
  studentSummary: AssessmentReport["studentSummary"];
  studentProfile?: {
    cet4Score?: StudentProfile["cet4Score"];
    cet4Status?: StudentProfile["cet4Status"];
    cet6Score?: StudentProfile["cet6Score"];
    cet6Status?: StudentProfile["cet6Status"];
    cohortSize?: StudentProfile["cohortSize"];
    college?: StudentProfile["college"];
    competitionSummary: string;
    dailyStudyHours?: StudentProfile["dailyStudyHours"];
    grade?: StudentProfile["grade"];
    major?: StudentProfile["major"];
    pathPreference?: StudentProfile["pathPreference"];
    rank?: StudentProfile["rank"];
    rankPercentile?: StudentProfile["rankPercentile"];
    researchSummary: string;
    riskPreference?: StudentProfile["riskPreference"];
    school?: StudentProfile["school"];
  };
  suggestedConversationTopics: string[];
  topGoals: string[];
  topPrograms: AssessmentReport["schoolRecommendations"];
  targetCities: string[];
  targetMajors: string[];
  targetUniversities: string[];
  topActionPriorities: AssessmentReport["actionPriorities"];
  topRisks: AssessmentReport["topRisks"];
  version: "lead-handoff-v0.2";
  whyContactNow: string[];
};
export type LeadScoringInput = {
  contact?: LeadContact;
  events: readonly LeadEvent[];
  profile: StudentProfile;
  report: AssessmentReport;
};
