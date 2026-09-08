import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LeadHandoffContext, LeadScore } from "@/domain/lead/models";
import { PostgresLeadRepository } from "./lead-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

const score: LeadScore = {
  calculatedAt: "2026-01-01T00:00:00.000Z",
  fitReasons: [],
  fitScore: 30,
  intentReasons: [],
  intentScore: 25,
  priority: "HIGH",
  qualification: "QUALIFIED",
  reasons: ["test"],
  riskFlags: [],
  total: 55,
  urgencyReasons: [],
  urgencyScore: 60,
  version: "lead-score-v0.2",
};

integration("PostgreSQL lead repository", () => {
  const sql = postgres(databaseUrl ?? "postgresql://invalid");
  const repository = new PostgresLeadRepository(sql);

  beforeAll(async () => {
    await sql`TRUNCATE lead_external_sync, lead_handoffs, lead_scores, lead_events, lead_contacts, leads CASCADE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("persists an idempotent lead, append-only events, score history, and handoff", async () => {
    const lead = await repository.createLead({
      assessmentId: "assessment-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "lead-1",
      source: "ASSESSMENT",
      status: "NEW",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const duplicate = await repository.createLead({
      ...lead,
      id: "lead-duplicate",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(duplicate.id).toBe("lead-1");
    await repository.upsertContact({
      consentAt: "2026-01-01T00:00:00.000Z",
      consentToContact: true,
      consentVersion: "contact-consent-v0.2",
      contactable: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      leadId: lead.id,
      phone: "13800138000",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const event = {
      eventKey: "lead-1:CONTACT_SUBMITTED",
      id: "event-1",
      leadId: lead.id,
      occurredAt: "2026-01-01T00:00:00.000Z",
      type: "CONTACT_SUBMITTED" as const,
    };
    await repository.addLeadEvent(event);
    await repository.addLeadEvent({ ...event, id: "event-duplicate" });
    expect(await repository.listEvents(lead.id)).toHaveLength(1);
    await repository.upsertLeadScore(lead.id, score);
    await repository.upsertLeadScore(lead.id, { ...score, total: 60 });
    expect((await repository.getLatestScore(lead.id))?.total).toBe(60);
    const handoff: LeadHandoffContext = {
      actionsAlreadyRecommended: [],
      consultationContext: { requestedReview: false },
      doNotPromise: [],
      leadId: lead.id,
      leadScore: score,
      missingInformation: [],
      postgraduateExamScore: {} as LeadHandoffContext["postgraduateExamScore"],
      recommendationScore: {} as LeadHandoffContext["recommendationScore"],
      recommendedConversationTopics: ["考研与保研双轨资源分配"],
      recommendedOpening: "先核对画像。",
      recommendedPath: "DUAL_TRACK",
      schoolRecommendations: [],
      studentSummary: {
        targetCities: [],
        targetMajors: [],
        targetUniversities: [],
      },
      suggestedConversationTopics: ["考研与保研双轨资源分配"],
      targetCities: [],
      targetMajors: [],
      targetUniversities: [],
      topActionPriorities: [],
      topGoals: [],
      topPrograms: [],
      topRisks: [],
      version: "lead-handoff-v0.2",
      whyContactNow: [],
    };
    await repository.createOrUpdateHandoff(handoff);
    const rows = await sql<
      { count: string }[]
    >`SELECT count(*)::text AS count FROM lead_handoffs WHERE lead_id = ${lead.id}`;
    expect(rows[0]?.count).toBe("1");
    await repository.saveSyncState({
      externalRecordId: "feishu-record-1",
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
      leadId: lead.id,
      notificationSentAt: "2026-01-01T00:00:00.000Z",
      notificationStatus: "SENT",
      syncStatus: "SYNCED",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(await repository.getSyncState(lead.id)).toMatchObject({
      externalRecordId: "feishu-record-1",
      notificationStatus: "SENT",
      syncStatus: "SYNCED",
    });
  });
});
