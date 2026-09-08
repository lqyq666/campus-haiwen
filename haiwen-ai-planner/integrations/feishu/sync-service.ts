import { isContactable } from "@/domain/lead/contactability";
import type { FeishuConfig } from "./config";
import {
  FEISHU_EVENT_FIELD_MAP,
  FEISHU_LEAD_FIELD_MAP,
  FEISHU_MANUAL_LEAD_FIELDS,
  mapEventToFeishuFields,
  mapLeadToFeishuFields,
} from "./lead-mapper";
import { createConsultantNotification } from "./notification";
import type {
  FeishuApi,
  FeishuLeadSyncRepository,
  LeadExternalSync,
} from "./types";

const syncedEventTypes = new Set([
  "ASSESSMENT_COMPLETED",
  "CONTACT_SUBMITTED",
  "REQUESTED_CONSULTATION",
  "RETURN_VISIT",
  "CHAT_STARTED",
]);

export class LeadCrmSyncService {
  private readonly api: FeishuApi;
  private readonly config: FeishuConfig;
  private readonly repository: FeishuLeadSyncRepository;
  constructor(
    repository: FeishuLeadSyncRepository,
    api: FeishuApi,
    config: FeishuConfig
  ) {
    this.repository = repository;
    this.api = api;
    this.config = config;
  }

  async syncLead(leadId: string): Promise<LeadExternalSync | undefined> {
    if (!this.config.enabled) {
      return;
    }
    const [lead, contact, score, handoff, events, previous] = await Promise.all(
      [
        this.repository.getLead(leadId),
        this.repository.getContact(leadId),
        this.repository.getLatestScore(leadId),
        this.repository.getHandoff(leadId),
        this.repository.listEvents(leadId),
        this.repository.getSyncState(leadId),
      ]
    );
    if (!lead || !score || !handoff) {
      return;
    }
    const base: LeadExternalSync = {
      ...previous,
      leadId,
      notificationStatus: previous?.notificationStatus ?? "PENDING",
      syncStatus: "PENDING" as const,
      updatedAt: new Date().toISOString(),
    };
    if (!isContactable(contact)) {
      const skipped: LeadExternalSync = {
        ...base,
        lastError: "CONTACT_CONSENT_REQUIRED",
        syncStatus: "SKIPPED_NO_CONSENT",
      };
      await this.repository.saveSyncState(skipped);
      return skipped;
    }
    try {
      const fields = mapLeadToFeishuFields(lead, contact, score, handoff);
      const existing = previous?.externalRecordId
        ? undefined
        : await this.api.findRecordByField(
            this.config.leadsTableId,
            FEISHU_LEAD_FIELD_MAP.leadId,
            lead.id
          );
      const recordId = previous?.externalRecordId ?? existing?.recordId;
      if (recordId) {
        const updateFields = Object.fromEntries(
          Object.entries(fields).filter(
            ([field]) => !FEISHU_MANUAL_LEAD_FIELDS.has(field)
          )
        );
        await this.api.updateRecord(
          this.config.leadsTableId,
          recordId,
          updateFields
        );
      } else {
        const created = await this.api.createRecord(
          this.config.leadsTableId,
          fields
        );
        base.externalRecordId = created.recordId;
      }
      const externalRecordId = recordId ?? base.externalRecordId;
      for (const event of events.filter((item) =>
        syncedEventTypes.has(item.type)
      )) {
        const eventKey = event.eventKey ?? event.id;
        // biome-ignore lint/performance/noAwaitInLoops: event writes retain deterministic, idempotent ordering.
        const found = await this.api.findRecordByField(
          this.config.eventsTableId,
          FEISHU_EVENT_FIELD_MAP.eventKey,
          eventKey
        );
        if (!found) {
          await this.api.createRecord(
            this.config.eventsTableId,
            mapEventToFeishuFields(event)
          );
        }
      }
      if (externalRecordId) {
        await this.api.updateRecord(
          this.config.leadsTableId,
          externalRecordId,
          {
            [FEISHU_LEAD_FIELD_MAP.crmSyncStatus]: "已同步",
          }
        );
      }
      const synced: LeadExternalSync = {
        ...base,
        externalRecordId,
        lastError: undefined,
        lastSyncedAt: new Date().toISOString(),
        notificationStatus: previous?.notificationStatus ?? "PENDING",
        syncStatus: "SYNCED",
        updatedAt: new Date().toISOString(),
      };
      await this.repository.saveSyncState(synced);
      return this.maybeNotify(
        synced,
        contact,
        handoff,
        score,
        events.some((event) => event.type === "REQUESTED_CONSULTATION")
      );
    } catch (error) {
      const failed: LeadExternalSync = {
        ...base,
        externalRecordId: previous?.externalRecordId,
        lastError:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "FEISHU_REQUEST_FAILED",
        notificationStatus: previous?.notificationStatus ?? "PENDING",
        syncStatus: "FAILED",
        updatedAt: new Date().toISOString(),
      };
      await this.repository.saveSyncState(failed);
      return failed;
    }
  }
  async retryFailedLeads(limit = 50) {
    const leadIds = await this.repository.listFailedSyncLeadIds(limit);
    let synced = 0;
    for (const leadId of leadIds) {
      // biome-ignore lint/performance/noAwaitInLoops: bounded operator retry stays deterministic.
      const result = await this.syncLead(leadId);
      if (result?.syncStatus === "SYNCED") {
        synced += 1;
      }
    }
    return { attempted: leadIds.length, synced };
  }
  private async maybeNotify(
    state: LeadExternalSync,
    contact: Awaited<ReturnType<FeishuLeadSyncRepository["getContact"]>>,
    handoff: Awaited<ReturnType<FeishuLeadSyncRepository["getHandoff"]>>,
    score: Awaited<ReturnType<FeishuLeadSyncRepository["getLatestScore"]>>,
    requested: boolean
  ): Promise<LeadExternalSync> {
    if (
      !this.config.notifyEnabled ||
      state.notificationSentAt ||
      !contact ||
      !handoff ||
      !score ||
      !isContactable(contact) ||
      !(score.qualification === "HOT" || score.priority === "URGENT")
    ) {
      return state;
    }
    try {
      await this.api.sendMessage(
        this.config.notifyReceiveId as string,
        this.config.notifyReceiveIdType as string,
        createConsultantNotification(contact, handoff, score, requested)
      );
      const sent = {
        ...state,
        notificationKey: `HOT:${state.leadId}:v1`,
        notificationSentAt: new Date().toISOString(),
        notificationStatus: "SENT" as const,
        updatedAt: new Date().toISOString(),
      };
      await this.repository.saveSyncState(sent);
      return sent;
    } catch {
      const failed = {
        ...state,
        notificationStatus: "FAILED" as const,
        updatedAt: new Date().toISOString(),
      };
      await this.repository.saveSyncState(failed);
      return failed;
    }
  }
}
