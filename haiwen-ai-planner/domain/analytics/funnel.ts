import type {
  AnalyticsEvent,
  AnalyticsEventFilter,
  AnalyticsEventType,
} from "./models";
import { matches } from "./repository";

const funnelSteps = [
  ["assessmentStart", "ASSESSMENT_STARTED"],
  ["assessmentComplete", "ASSESSMENT_COMPLETED"],
  ["reportView", "REPORT_VIEWED"],
  ["evidenceOpen", "EVIDENCE_OPENED"],
  ["reviewCta", "REVIEW_CTA_CLICKED"],
  ["leadSubmit", "LEAD_SUBMITTED"],
  ["consent", "CONSENT_GRANTED"],
  ["consultantContact", "CONSULTANT_CONTACTED"],
  ["appointment", "APPOINTMENT_CREATED"],
  ["sale", "SALE_CONVERTED"],
] as const satisfies readonly (readonly [string, AnalyticsEventType])[];

export function aggregateFunnel(
  events: readonly AnalyticsEvent[],
  filter: AnalyticsEventFilter
) {
  const filtered = events.filter((event) => matches(event, filter));
  const steps = funnelSteps.map(([key, eventType]) => ({
    count: new Set(
      filtered
        .filter((event) => event.eventType === eventType)
        .map(subjectIdentifier)
    ).size,
    eventType,
    key,
  }));
  const counts = Object.fromEntries(
    steps.map((step) => [step.key, step.count])
  );
  return {
    filter,
    metrics: {
      appointmentRate: rate(counts.appointment, counts.consultantContact),
      assessmentCompletionRate: rate(
        counts.assessmentComplete,
        counts.assessmentStart
      ),
      consentRate: rate(counts.consent, counts.leadSubmit),
      consultantContactRate: rate(counts.consultantContact, counts.consent),
      evidenceOpenRate: rate(counts.evidenceOpen, counts.reportView),
      leadSubmissionRate: rate(counts.leadSubmit, counts.reviewCta),
      reportViewRate: rate(counts.reportView, counts.assessmentComplete),
      reviewCtaRate: rate(counts.reviewCta, counts.evidenceOpen),
      saleConversionRate: rate(counts.sale, counts.appointment),
    },
    schemaVersion: "analytics-funnel-v0.2" as const,
    steps,
  };
}

function subjectIdentifier(event: AnalyticsEvent) {
  return (
    event.sessionId ?? event.studentProfileId ?? event.leadId ?? event.eventId
  );
}

function rate(numerator = 0, denominator = 0) {
  return denominator > 0 ? numerator / denominator : 0;
}
