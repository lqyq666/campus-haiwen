export const analyticsEventTypes = [
  "SESSION_CREATED",
  "ASSESSMENT_STARTED",
  "QUESTION_ANSWERED",
  "FOLLOWUP_QUESTION_SHOWN",
  "ASSESSMENT_COMPLETED",
  "REPORT_VIEWED",
  "SCORE_EXPLANATION_OPENED",
  "PROGRAM_OPENED",
  "EVIDENCE_OPENED",
  "ROADMAP_VIEWED",
  "REVIEW_CTA_CLICKED",
  "CONTACT_FORM_STARTED",
  "LEAD_SUBMITTED",
  "CONSENT_GRANTED",
  "CRM_SYNC_STARTED",
  "CRM_SYNCED",
  "CRM_SYNC_FAILED",
  "CONSULTANT_CONTACTED",
  "APPOINTMENT_CREATED",
  "SALE_CONVERTED",
] as const;

export type AnalyticsEventType = (typeof analyticsEventTypes)[number];

export type AnalyticsEvent = {
  cohortTag?: string;
  eventId: string;
  eventType: AnalyticsEventType;
  leadId?: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  programId?: string;
  receivedAt: string;
  schemaVersion: "analytics-event-v0.2";
  sessionId?: string;
  studentProfileId?: string;
};

export type AnalyticsEventFilter = {
  cohortTag?: string;
  from?: string;
  to?: string;
};
