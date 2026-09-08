export type SourceType =
  | "OFFICIAL_ADMISSION_NOTICE"
  | "OFFICIAL_PROGRAM_CATALOG"
  | "SUMMER_CAMP_NOTICE"
  | "PRE_RECOMMENDATION_NOTICE"
  | "RETEST_NOTICE"
  | "ADMISSION_RESULT"
  | "TEST_FIXTURE"
  | "OTHER";

export type SourceTrust =
  | "OFFICIAL"
  | "INSTITUTIONAL"
  | "TEST_FIXTURE"
  | "UNKNOWN";

export type SourceDocument = {
  admissionYear?: number;
  canonicalUrl?: string;
  contentHash: string;
  createdAt: string;
  fetchedAt: string;
  id: string;
  publishedAt?: string;
  publisher?: string;
  rawText?: string;
  sourceTrust: SourceTrust;
  sourceType: SourceType;
  sourceUrl: string;
  title: string;
  updatedAt: string;
};

export type EvidenceType =
  | "EXAM_SUBJECT"
  | "ENROLLMENT"
  | "ELIGIBILITY"
  | "APPLICATION_WINDOW"
  | "POLICY_TEXT"
  | "OTHER";

export type Evidence = {
  contentHash: string;
  createdAt: string;
  endOffset?: number;
  evidenceType: EvidenceType;
  excerpt: string;
  id: string;
  normalizedExcerpt?: string;
  programId: string;
  sourceDocumentId: string;
  startOffset?: number;
};

export type EvidenceRelevance = "DIRECT" | "SUPPORTING" | "CONTEXTUAL";
export type EvidenceFreshness =
  | "CURRENT"
  | "LATEST_OFFICIAL_HISTORICAL"
  | "OUTDATED"
  | "UNKNOWN";
export type EvidenceStrength = "HIGH" | "MEDIUM" | "LOW";

export type VerifiedEvidence = Evidence & {
  freshness: EvidenceFreshness;
  relevance: EvidenceRelevance;
  strength: EvidenceStrength;
  verified: true;
};
