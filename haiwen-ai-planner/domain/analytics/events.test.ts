import { describe, expect, it } from "vitest";
import { aggregateFunnel } from "./funnel";
import { InMemoryAnalyticsEventRepository } from "./repository";
import { parseAnalyticsEvent } from "./schema";

const base = {
  occurredAt: "2026-08-30T00:00:00.000Z",
  schemaVersion: "analytics-event-v0.2" as const,
  sessionId: "session-1",
};

describe("analytics event model", () => {
  it("accepts missing optional identifiers and rejects unknown event types", () => {
    expect(
      parseAnalyticsEvent({
        eventId: "event-1",
        eventType: "SESSION_CREATED",
        occurredAt: base.occurredAt,
      }).leadId
    ).toBeUndefined();
    expect(() =>
      parseAnalyticsEvent({
        eventId: "event-2",
        eventType: "UNKNOWN_EVENT",
        occurredAt: base.occurredAt,
      })
    ).toThrow();
  });

  it("deduplicates retries by event id and orders by occurred time", async () => {
    const repository = new InMemoryAnalyticsEventRepository();
    const later = parseAnalyticsEvent({
      ...base,
      eventId: "event-2",
      eventType: "ASSESSMENT_COMPLETED",
      occurredAt: "2026-08-30T00:02:00.000Z",
    });
    const earlier = parseAnalyticsEvent({
      ...base,
      eventId: "event-1",
      eventType: "ASSESSMENT_STARTED",
      occurredAt: "2026-08-30T00:01:00.000Z",
    });
    expect(await repository.ingest(later)).toBe(true);
    expect(await repository.ingest(later)).toBe(false);
    await repository.ingest(earlier);
    expect((await repository.list({})).map((event) => event.eventId)).toEqual([
      "event-1",
      "event-2",
    ]);
  });
});

it("aggregates a dated and cohort-filtered funnel", () => {
  const types = [
    "ASSESSMENT_STARTED",
    "ASSESSMENT_COMPLETED",
    "REPORT_VIEWED",
    "EVIDENCE_OPENED",
    "REVIEW_CTA_CLICKED",
    "LEAD_SUBMITTED",
    "CONSENT_GRANTED",
    "CONSULTANT_CONTACTED",
    "APPOINTMENT_CREATED",
    "SALE_CONVERTED",
  ] as const;
  const events = types.map((eventType, index) =>
    parseAnalyticsEvent({
      ...base,
      cohortTag: "pilot_001",
      eventId: `event-${index}`,
      eventType,
      occurredAt: `2026-08-30T00:${String(index).padStart(2, "0")}:00.000Z`,
    })
  );
  const result = aggregateFunnel(events, {
    cohortTag: "pilot_001",
    from: "2026-08-30T00:00:00.000Z",
    to: "2026-08-31T00:00:00.000Z",
  });
  expect(result.steps.every((step) => step.count === 1)).toBe(true);
  expect(result.metrics.saleConversionRate).toBe(1);
});
