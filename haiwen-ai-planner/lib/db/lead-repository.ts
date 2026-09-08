import type postgres from "postgres";
import { canTransitionLeadStatus } from "@/domain/lead/lifecycle";
import type {
  Lead,
  LeadContact,
  LeadEvent,
  LeadHandoffContext,
  LeadScore,
} from "@/domain/lead/models";
import type { LeadCRM } from "@/integrations/crm/contract";
import type {
  FeishuLeadSyncRepository,
  LeadExternalSync,
} from "@/integrations/feishu/types";

type Sql = ReturnType<typeof postgres>;
export class PostgresLeadRepository
  implements LeadCRM, FeishuLeadSyncRepository
{
  private readonly sql: Sql;
  constructor(sql: Sql) {
    this.sql = sql;
  }
  async createLead(lead: Lead) {
    const rows = await this.sql<
      Lead[]
    >`INSERT INTO leads (id, assessment_id, student_profile_id, status, source, created_at, updated_at) VALUES (${lead.id}, ${lead.assessmentId ?? null}, ${lead.studentProfileId ?? null}, ${lead.status}, ${lead.source}, ${lead.createdAt}, ${lead.updatedAt}) ON CONFLICT (assessment_id) DO UPDATE SET updated_at = EXCLUDED.updated_at RETURNING id, assessment_id AS "assessmentId", student_profile_id AS "studentProfileId", status, source, created_at AS "createdAt", updated_at AS "updatedAt"`;
    const [createdLead] = rows;
    if (!createdLead) {
      throw new Error("Lead creation did not return a row");
    }
    return createdLead;
  }
  async getLead(id: string) {
    const rows = await this.sql<
      Lead[]
    >`SELECT id, assessment_id AS "assessmentId", student_profile_id AS "studentProfileId", status, source, created_at AS "createdAt", updated_at AS "updatedAt" FROM leads WHERE id = ${id}`;
    return rows[0];
  }
  async updateLead(lead: Lead) {
    const existing = await this.getLead(lead.id);
    if (!existing) {
      throw new Error(`Lead ${lead.id} does not exist`);
    }
    if (!canTransitionLeadStatus(existing.status, lead.status)) {
      throw new Error(
        `Invalid lead status transition: ${existing.status} -> ${lead.status}`
      );
    }
    await this
      .sql`UPDATE leads SET status=${lead.status}, updated_at=${lead.updatedAt} WHERE id=${lead.id}`;
    return lead;
  }
  async upsertContact(contact: LeadContact) {
    await this
      .sql`INSERT INTO lead_contacts (lead_id, name, phone, wechat, qq, email, preferred_contact_method, consent_to_contact, contact_consent, consent_at, consent_version, contactable, created_at, updated_at) VALUES (${contact.leadId}, ${contact.name ?? null}, ${contact.phone ?? null}, ${contact.wechat ?? null}, ${contact.qq ?? null}, ${contact.email ?? null}, ${contact.preferredContactMethod ?? null}, ${contact.consentToContact}, ${contact.consentToContact}, ${contact.consentAt ?? null}, ${contact.consentVersion}, ${contact.contactable}, ${contact.createdAt}, ${contact.updatedAt}) ON CONFLICT (lead_id) DO UPDATE SET name=EXCLUDED.name, phone=EXCLUDED.phone, wechat=EXCLUDED.wechat, qq=EXCLUDED.qq, email=EXCLUDED.email, preferred_contact_method=EXCLUDED.preferred_contact_method, consent_to_contact=EXCLUDED.consent_to_contact, contact_consent=EXCLUDED.contact_consent, consent_at=EXCLUDED.consent_at, consent_version=EXCLUDED.consent_version, contactable=EXCLUDED.contactable, updated_at=EXCLUDED.updated_at`;
  }
  async addLeadEvent(event: LeadEvent) {
    await this
      .sql`INSERT INTO lead_events (id, lead_id, type, occurred_at, metadata, event_key) VALUES (${event.id}, ${event.leadId}, ${event.type}, ${event.occurredAt}, ${this.sql.json((event.metadata ?? {}) as never)}, ${event.eventKey ?? null}) ON CONFLICT (event_key) DO NOTHING`;
  }
  listEvents(leadId: string) {
    return this.sql<
      LeadEvent[]
    >`SELECT id, lead_id AS "leadId", type, occurred_at AS "occurredAt", metadata, event_key AS "eventKey" FROM lead_events WHERE lead_id=${leadId} ORDER BY occurred_at, id`;
  }
  async upsertLeadScore(leadId: string, score: LeadScore) {
    await this
      .sql`INSERT INTO lead_scores (lead_id, score, calculated_at) VALUES (${leadId}, ${this.sql.json(score)}, ${score.calculatedAt})`;
  }
  async getLatestScore(leadId: string) {
    const rows = await this.sql<
      { score: LeadScore }[]
    >`SELECT score FROM lead_scores WHERE lead_id=${leadId} ORDER BY id DESC LIMIT 1`;
    return rows[0]?.score;
  }
  async getContact(leadId: string) {
    const rows = await this.sql<
      LeadContact[]
    >`SELECT lead_id AS "leadId", name, phone, wechat, qq, email, preferred_contact_method AS "preferredContactMethod", contact_consent AS "consentToContact", consent_at AS "consentAt", consent_version AS "consentVersion", contactable, created_at AS "createdAt", updated_at AS "updatedAt" FROM lead_contacts WHERE lead_id=${leadId}`;
    return rows[0];
  }
  async getHandoff(leadId: string) {
    const rows = await this.sql<
      { context: LeadHandoffContext }[]
    >`SELECT context FROM lead_handoffs WHERE lead_id=${leadId}`;
    return rows[0]?.context;
  }
  async getSyncState(leadId: string) {
    const rows = await this.sql<
      LeadExternalSync[]
    >`SELECT lead_id AS "leadId", external_record_id AS "externalRecordId", last_error AS "lastError", last_synced_at AS "lastSyncedAt", notification_key AS "notificationKey", notification_sent_at AS "notificationSentAt", notification_status AS "notificationStatus", sync_status AS "syncStatus", updated_at AS "updatedAt" FROM lead_external_sync WHERE lead_id=${leadId}`;
    return rows[0];
  }
  async listFailedSyncLeadIds(limit = 50) {
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    const rows = await this.sql<
      { leadId: string }[]
    >`SELECT lead_id AS "leadId" FROM lead_external_sync WHERE sync_status = 'FAILED' ORDER BY updated_at ASC LIMIT ${safeLimit}`;
    return rows.map((row) => row.leadId);
  }
  async saveSyncState(state: LeadExternalSync) {
    await this
      .sql`INSERT INTO lead_external_sync (lead_id, external_system, external_record_id, sync_status, last_synced_at, last_error, notification_status, notification_sent_at, notification_key, updated_at) VALUES (${state.leadId}, 'FEISHU', ${state.externalRecordId ?? null}, ${state.syncStatus}, ${state.lastSyncedAt ?? null}, ${state.lastError ?? null}, ${state.notificationStatus}, ${state.notificationSentAt ?? null}, ${state.notificationKey ?? null}, ${state.updatedAt}) ON CONFLICT (lead_id) DO UPDATE SET external_record_id=EXCLUDED.external_record_id, sync_status=EXCLUDED.sync_status, last_synced_at=EXCLUDED.last_synced_at, last_error=EXCLUDED.last_error, notification_status=EXCLUDED.notification_status, notification_sent_at=EXCLUDED.notification_sent_at, notification_key=EXCLUDED.notification_key, updated_at=EXCLUDED.updated_at`;
  }
  async createOrUpdateHandoff(context: LeadHandoffContext) {
    await this
      .sql`INSERT INTO lead_handoffs (lead_id, context, updated_at) VALUES (${context.leadId}, ${this.sql.json(context)}, now()) ON CONFLICT (lead_id) DO UPDATE SET context=EXCLUDED.context, updated_at=EXCLUDED.updated_at`;
  }
}
