import { describe, expect, it } from "vitest";
import type {
  Lead,
  LeadContact,
  LeadEvent,
  LeadHandoffContext,
  LeadScore,
} from "@/domain/lead/models";
import type { FeishuConfig } from "./config";
import { FakeFeishuClient } from "./fake-client";
import { FEISHU_LEAD_FIELD_MAP } from "./lead-mapper";
import { LeadCrmSyncService } from "./sync-service";
import type { FeishuLeadSyncRepository, LeadExternalSync } from "./types";

const lead: Lead = {
  createdAt: "2026-01-01T00:00:00.000Z",
  id: "lead-1",
  source: "ASSESSMENT",
  status: "READY_FOR_CONSULTANT",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const contact: LeadContact = {
  consentToContact: true,
  consentVersion: "contact-consent-v0.2",
  contactable: true,
  createdAt: lead.createdAt,
  leadId: lead.id,
  phone: "13800138000",
  updatedAt: lead.updatedAt,
};
const score: LeadScore = {
  calculatedAt: lead.createdAt,
  fitReasons: [],
  fitScore: 35,
  intentReasons: [],
  intentScore: 35,
  priority: "URGENT",
  qualification: "HOT",
  reasons: [],
  riskFlags: [],
  total: 70,
  urgencyReasons: [],
  urgencyScore: 100,
  version: "lead-score-v0.2",
};
const handoff: LeadHandoffContext = {
  actionsAlreadyRecommended: [],
  advisorSummary: "成都理工大学学生，双轨准备。",
  consultationContext: { requestedReview: true },
  doNotPromise: [],
  leadId: lead.id,
  leadScore: score,
  missingInformation: [],
  postgraduateExamScore: {} as never,
  recommendationScore: {} as never,
  recommendedConversationTopics: ["双轨资源分配"],
  recommendedOpening: "先核对画像。",
  recommendedPath: "DUAL_TRACK",
  schoolRecommendations: [],
  studentSummary: {
    targetCities: [],
    targetMajors: [],
    targetUniversities: [],
  },
  suggestedConversationTopics: ["双轨资源分配"],
  targetCities: ["上海"],
  targetMajors: ["计算机"],
  targetUniversities: [],
  topActionPriorities: [],
  topGoals: [],
  topPrograms: [],
  topRisks: [],
  version: "lead-handoff-v0.2",
  whyContactNow: [],
};
const events: LeadEvent[] = [
  {
    eventKey: "lead-1:CONTACT_SUBMITTED",
    id: "event-1",
    leadId: lead.id,
    occurredAt: lead.createdAt,
    type: "CONTACT_SUBMITTED",
  },
];
const config: FeishuConfig = {
  appId: "id",
  appSecret: "secret",
  appToken: "app",
  enabled: true,
  eventsTableId: "events",
  leadsTableId: "leads",
  notifyEnabled: true,
  notifyReceiveId: "user",
  notifyReceiveIdType: "open_id",
  timeoutMs: 20,
};

class MemoryRepository implements FeishuLeadSyncRepository {
  state?: LeadExternalSync;
  getContact() {
    return Promise.resolve(contact);
  }
  getHandoff() {
    return Promise.resolve(handoff);
  }
  getLead() {
    return Promise.resolve(lead);
  }
  getLatestScore() {
    return Promise.resolve(score);
  }
  getSyncState() {
    return Promise.resolve(this.state);
  }
  listEvents() {
    return Promise.resolve(events);
  }
  listFailedSyncLeadIds() {
    return Promise.resolve(
      this.state?.syncStatus === "FAILED" ? [lead.id] : []
    );
  }
  saveSyncState(state: LeadExternalSync) {
    this.state = state;
    return Promise.resolve();
  }
}

describe("LeadCrmSyncService", () => {
  it("upserts one lead and event across repeated syncs, then deduplicates notification", async () => {
    const repository = new MemoryRepository();
    const api = new FakeFeishuClient();
    const service = new LeadCrmSyncService(repository, api, config);
    await service.syncLead(lead.id);
    await service.syncLead(lead.id);
    expect(api.records.get("leads")).toHaveLength(1);
    expect(api.records.get("events")).toHaveLength(1);
    expect(api.messages).toHaveLength(1);
    expect(repository.state?.syncStatus).toBe("SYNCED");
    expect(api.records.get("leads")?.[0]?.fields.同步状态).toBe("已同步");
  });
  it("does not project a contactable CRM lead when consent is absent", async () => {
    const repository = new MemoryRepository();
    const api = new FakeFeishuClient();
    repository.getContact = async () => ({
      ...contact,
      consentToContact: false,
      contactable: false,
    });
    await new LeadCrmSyncService(repository, api, config).syncLead(lead.id);
    expect(api.records.get("leads") ?? []).toHaveLength(0);
    expect(api.messages).toHaveLength(0);
    expect(repository.state?.syncStatus).toBe("SKIPPED_NO_CONSENT");
  });
  it("persists a failed sync and succeeds on retry", async () => {
    const repository = new MemoryRepository();
    const api = new FakeFeishuClient();
    api.failure = new Error("offline");
    const service = new LeadCrmSyncService(repository, api, config);
    await service.syncLead(lead.id);
    expect(repository.state?.syncStatus).toBe("FAILED");
    api.failure = undefined;
    expect(await service.retryFailedLeads()).toEqual({
      attempted: 1,
      synced: 1,
    });
    expect(repository.state?.syncStatus).toBe("SYNCED");
    expect(repository.state?.lastError).toBeUndefined();
  });

  it("does not overwrite manually maintained sales fields on duplicate sync", async () => {
    const repository = new MemoryRepository();
    const api = new FakeFeishuClient();
    const service = new LeadCrmSyncService(repository, api, config);
    await service.syncLead(lead.id);
    const fields = api.records.get("leads")?.[0]?.fields;
    if (!fields) {
      throw new Error("missing fake lead");
    }
    fields[FEISHU_LEAD_FIELD_MAP.salesStatus] = "已联系";
    fields[FEISHU_LEAD_FIELD_MAP.advisor] = "顾问A";
    fields[FEISHU_LEAD_FIELD_MAP.followUpNotes] = "明天回访";
    await service.syncLead(lead.id);
    const updated = api.records.get("leads")?.[0]?.fields;
    expect(updated?.[FEISHU_LEAD_FIELD_MAP.salesStatus]).toBe("已联系");
    expect(updated?.[FEISHU_LEAD_FIELD_MAP.advisor]).toBe("顾问A");
    expect(updated?.[FEISHU_LEAD_FIELD_MAP.followUpNotes]).toBe("明天回访");
  });
});
