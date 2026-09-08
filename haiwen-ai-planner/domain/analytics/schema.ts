import { z } from "zod";
import { type AnalyticsEvent, analyticsEventTypes } from "./models";

const optionalIdentifier = z.string().trim().min(1).max(128).optional();

export const analyticsEventInputSchema = z
  .object({
    cohortTag: optionalIdentifier,
    eventId: z.string().trim().min(1).max(128),
    eventType: z.enum(analyticsEventTypes),
    leadId: optionalIdentifier,
    metadata: z.record(z.string(), z.unknown()).default({}),
    occurredAt: z.string().datetime({ offset: true }),
    programId: optionalIdentifier,
    schemaVersion: z
      .literal("analytics-event-v0.2")
      .default("analytics-event-v0.2"),
    sessionId: optionalIdentifier,
    studentProfileId: optionalIdentifier,
  })
  .strict();

export function parseAnalyticsEvent(
  input: unknown,
  receivedAt = new Date().toISOString()
): AnalyticsEvent {
  return { ...analyticsEventInputSchema.parse(input), receivedAt };
}
