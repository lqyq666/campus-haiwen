import { ipAddress } from "@vercel/functions";
import { after } from "next/server";
import { z } from "zod";
import { parseAnalyticsEvent } from "@/domain/analytics/schema";
import { buildLeadContact } from "@/domain/lead/contactability";
import { createLeadHandoffContext } from "@/domain/lead/handoff";
import { leadContactSchema } from "@/domain/lead/schema";
import { calculateLeadScore, statusForLead } from "@/domain/lead/scoring";
import type { AssessmentReport } from "@/domain/recommendation/models";
import { studentProfileSchema } from "@/domain/student/schema";
import { syncRuntimeLead } from "@/integrations/feishu";
import { ChatbotError } from "@/lib/errors";
import { logBusinessEvent } from "@/lib/observability/business-log";
import { checkIpRateLimit } from "@/lib/ratelimit";
import { getRuntimeSchoolDataRepositories } from "@/lib/repositories/school-data";

const advisorContextSchema = z.object({
  advisorHelp: z.string().trim().max(200).optional(),
  attemptedAction: z.string().trim().max(200).optional(),
  biggestWorry: z.string().trim().max(200).optional(),
  currentConcern: z.string().trim().max(200).optional(),
  decisionDeadline: z.string().trim().max(200).optional(),
  next30DayGoal: z.string().trim().max(200).optional(),
  sevenDayAction: z.string().trim().max(200).optional(),
  specificBlocker: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    await checkIpRateLimit(ipAddress(request), "lead");
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    throw error;
  }
  const body = (await request.json()) as {
    assessmentId?: string;
    advisorContext?: unknown;
    cohortTag?: string;
    contact?: unknown;
    profile?: unknown;
    report?: AssessmentReport;
    requestConsultation?: boolean;
    sessionId?: string;
  };
  const parsed = leadContactSchema.safeParse(body.contact);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 }
    );
  }
  const advisorContext = advisorContextSchema.safeParse(
    body.advisorContext ?? {}
  );
  if (!advisorContext.success) {
    return Response.json(
      { error: advisorContext.error.issues.map((issue) => issue.message) },
      { status: 400 }
    );
  }
  const profile = studentProfileSchema.safeParse(body.profile);
  if (!profile.success || !body.report) {
    return Response.json(
      { error: "A valid student profile and assessment report are required" },
      { status: 400 }
    );
  }
  const now = new Date().toISOString();
  const id = `lead-${body.assessmentId ?? crypto.randomUUID()}`;
  const repositories = getRuntimeSchoolDataRepositories();
  const crm = repositories.leadRepository;
  const lead = await crm.createLead({
    assessmentId: body.assessmentId,
    createdAt: now,
    id,
    source: "ASSESSMENT",
    status: "NEW",
    updatedAt: now,
  });
  const contact = buildLeadContact(
    {
      ...parsed.data,
      email: parsed.data.email || undefined,
      leadId: lead.id,
      phone: parsed.data.phone || undefined,
      qq: parsed.data.qq || undefined,
      wechat: parsed.data.wechat || undefined,
    },
    now
  );
  await crm.upsertContact(contact);
  await crm.addLeadEvent({
    eventKey: `${lead.id}:ASSESSMENT_COMPLETED`,
    id: crypto.randomUUID(),
    leadId: lead.id,
    occurredAt: now,
    type: "ASSESSMENT_COMPLETED",
  });
  await crm.addLeadEvent({
    eventKey: `${lead.id}:REPORT_VIEWED`,
    id: crypto.randomUUID(),
    leadId: lead.id,
    occurredAt: now,
    type: "REPORT_VIEWED",
  });
  await crm.addLeadEvent({
    eventKey: `${lead.id}:CONTACT_SUBMITTED`,
    id: crypto.randomUUID(),
    leadId: lead.id,
    occurredAt: now,
    type: "CONTACT_SUBMITTED",
  });
  if (body.requestConsultation) {
    await crm.addLeadEvent({
      eventKey: `${lead.id}:REQUESTED_CONSULTATION`,
      id: crypto.randomUUID(),
      leadId: lead.id,
      occurredAt: now,
      type: "REQUESTED_CONSULTATION",
    });
  }
  const events = await crm.listEvents(lead.id);
  const score = calculateLeadScore({
    contact,
    events,
    profile: profile.data,
    report: body.report,
  });
  await crm.upsertLeadScore(lead.id, score);
  await crm.updateLead({
    ...lead,
    status: statusForLead(score, contact),
    updatedAt: now,
  });
  await crm.createOrUpdateHandoff(
    createLeadHandoffContext(lead.id, body.report, score, profile.data, {
      ...advisorContext.data,
      requestedReview: Boolean(body.requestConsultation),
    })
  );
  const ingestBusinessEvent = (
    eventType:
      | "LEAD_SUBMITTED"
      | "CONSENT_GRANTED"
      | "CRM_SYNC_STARTED"
      | "CRM_SYNCED"
      | "CRM_SYNC_FAILED"
  ) =>
    repositories.analyticsEventRepository.ingest(
      parseAnalyticsEvent(
        {
          cohortTag: body.cohortTag,
          eventId: `${lead.id}:${eventType}`,
          eventType,
          leadId: lead.id,
          occurredAt: now,
          sessionId: body.sessionId,
        },
        now
      )
    );
  await ingestBusinessEvent("LEAD_SUBMITTED");
  if (contact.contactable) {
    await ingestBusinessEvent("CONSENT_GRANTED");
  }
  // PostgreSQL is committed before this best-effort CRM projection. Run Feishu
  // after the response so external latency never holds the student form open.
  if (contact.contactable) {
    after(async () => {
      try {
        await ingestBusinessEvent("CRM_SYNC_STARTED");
        const sync = await syncRuntimeLead(lead.id, crm);
        if (sync?.syncStatus === "SYNCED") {
          await ingestBusinessEvent("CRM_SYNCED");
        } else if (sync?.syncStatus === "FAILED") {
          await ingestBusinessEvent("CRM_SYNC_FAILED");
        }
      } catch {
        await ingestBusinessEvent("CRM_SYNC_FAILED");
        // Misconfiguration is an operator concern; the persisted lead remains usable.
      }
    });
  }
  logBusinessEvent("lead_persisted", {
    contactable: contact.contactable,
    leadId: lead.id,
    qualification: score.qualification,
    sessionId: body.sessionId,
  });
  return Response.json({ leadId: lead.id, qualification: score.qualification });
}
