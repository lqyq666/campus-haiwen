import type {
  Lead,
  LeadContact,
  LeadEvent,
  LeadHandoffContext,
  LeadScore,
} from "@/domain/lead/models";

export type FeishuSyncStatus =
  | "PENDING"
  | "SYNCED"
  | "FAILED"
  | "SKIPPED_NO_CONSENT";
export type FeishuNotificationStatus = "PENDING" | "SENT" | "FAILED";

export type LeadExternalSync = {
  externalRecordId?: string;
  lastError?: string;
  lastSyncedAt?: string;
  leadId: string;
  notificationKey?: string;
  notificationSentAt?: string;
  notificationStatus: FeishuNotificationStatus;
  syncStatus: FeishuSyncStatus;
  updatedAt: string;
};

export type FeishuLeadSyncRepository = {
  getContact: (leadId: string) => Promise<LeadContact | undefined>;
  getHandoff: (leadId: string) => Promise<LeadHandoffContext | undefined>;
  getLead: (id: string) => Promise<Lead | undefined>;
  getLatestScore: (leadId: string) => Promise<LeadScore | undefined>;
  getSyncState: (leadId: string) => Promise<LeadExternalSync | undefined>;
  listFailedSyncLeadIds: (limit?: number) => Promise<string[]>;
  listEvents: (leadId: string) => Promise<LeadEvent[]>;
  saveSyncState: (state: LeadExternalSync) => Promise<void>;
};

export type FeishuRecord = {
  fields: Record<string, unknown>;
  recordId: string;
};
export type FeishuApi = {
  createRecord: (
    tableId: string,
    fields: Record<string, unknown>
  ) => Promise<FeishuRecord>;
  findRecordByField: (
    tableId: string,
    field: string,
    value: string
  ) => Promise<FeishuRecord | undefined>;
  sendMessage: (
    receiveId: string,
    receiveIdType: string,
    content: string
  ) => Promise<void>;
  updateRecord: (
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>
  ) => Promise<void>;
};
