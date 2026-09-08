import type { LeadStatus } from "./models";

const transitions: Record<LeadStatus, readonly LeadStatus[]> = {
  CLOSED_LOST: [],
  CONTACTED: ["CONVERTED", "CLOSED_LOST"],
  CONVERTED: [],
  NEW: ["NURTURING", "QUALIFIED", "READY_FOR_CONSULTANT", "CLOSED_LOST"],
  NURTURING: ["QUALIFIED", "READY_FOR_CONSULTANT", "CLOSED_LOST"],
  QUALIFIED: ["READY_FOR_CONSULTANT", "CONTACTED", "CLOSED_LOST"],
  READY_FOR_CONSULTANT: ["CONTACTED", "CLOSED_LOST"],
};

export function canTransitionLeadStatus(
  from: LeadStatus,
  to: LeadStatus
): boolean {
  return from === to || transitions[from].includes(to);
}
