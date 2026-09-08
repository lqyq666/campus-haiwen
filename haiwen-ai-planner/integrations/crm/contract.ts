import type {
  Lead,
  LeadContact,
  LeadEvent,
  LeadHandoffContext,
  LeadScore,
} from "@/domain/lead/models";
export interface LeadCRM {
  addLeadEvent: (event: LeadEvent) => Promise<void>;
  createLead: (lead: Lead) => Promise<Lead>;
  createOrUpdateHandoff: (context: LeadHandoffContext) => Promise<void>;
  getLatestScore: (leadId: string) => Promise<LeadScore | undefined>;
  getLead: (id: string) => Promise<Lead | undefined>;
  listEvents: (leadId: string) => Promise<LeadEvent[]>;
  updateLead: (lead: Lead) => Promise<Lead>;
  upsertContact: (contact: LeadContact) => Promise<void>;
  upsertLeadScore: (leadId: string, score: LeadScore) => Promise<void>;
}
