import { ipAddress } from "@vercel/functions";
import type { AnalyticsEvent } from "@/domain/analytics/models";
import { parseAnalyticsEvent } from "@/domain/analytics/schema";
import { ChatbotError } from "@/lib/errors";
import { logBusinessEvent } from "@/lib/observability/business-log";
import { checkIpRateLimit } from "@/lib/ratelimit";
import { getRuntimeSchoolDataRepositories } from "@/lib/repositories/school-data";

export async function POST(request: Request) {
  try {
    await checkIpRateLimit(ipAddress(request), "event");
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    throw error;
  }
  let event: AnalyticsEvent;
  try {
    event = parseAnalyticsEvent(await request.json());
  } catch {
    return Response.json({ error: "Invalid analytics event" }, { status: 400 });
  }
  const inserted =
    await getRuntimeSchoolDataRepositories().analyticsEventRepository.ingest(
      event
    );
  logBusinessEvent("analytics_event_ingested", {
    eventId: event.eventId,
    eventType: event.eventType,
    inserted,
    leadId: event.leadId,
    sessionId: event.sessionId,
  });
  return Response.json(
    { eventId: event.eventId, status: inserted ? "INGESTED" : "DUPLICATE" },
    { status: inserted ? 201 : 200 }
  );
}
