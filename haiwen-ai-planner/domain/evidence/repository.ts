import type { Evidence, SourceDocument } from "./models";

export type EvidenceSearchCriteria = {
  admissionYear?: number;
  keywords: string[];
  programIds?: string[];
};

export interface EvidenceRepository {
  findEvidenceForProgram: (programId: string) => Promise<Evidence[]>;
  getEvidence: (id: string) => Promise<Evidence | undefined>;
  getSourceDocument: (id: string) => Promise<SourceDocument | undefined>;
  searchEvidence: (criteria: EvidenceSearchCriteria) => Promise<Evidence[]>;
}
