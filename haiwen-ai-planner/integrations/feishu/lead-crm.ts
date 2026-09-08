export type LeadRecord = {
  id: string;
  studentProfileId: string;
};

export type LeadEvent = {
  occurredAt: Date;
  type: string;
};

export interface LeadCRM {
  addLeadEvent: (leadId: string, event: LeadEvent) => Promise<void>;
  createLead: (lead: LeadRecord) => Promise<void>;
  updateLead: (lead: LeadRecord) => Promise<void>;
}
