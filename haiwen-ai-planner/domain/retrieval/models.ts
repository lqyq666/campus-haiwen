import type { Evidence, SourceDocument } from "@/domain/evidence/models";

export type DocumentChunk = {
  admissionYear?: number;
  chunkIndex: number;
  content: string;
  contentHash: string;
  createdAt: string;
  id: string;
  normalizedContent: string;
  programId?: string;
  sourceDocumentId: string;
};

export type EmbeddingRecord = {
  chunkId: string;
  contentHash: string;
  createdAt: string;
  dimensions: number;
  embedding: number[];
  model: string;
};

export type RetrievalQuery = {
  admissionYear: number;
  programIds: string[];
  text: string;
};

export type RetrievedChunk = {
  chunk: DocumentChunk;
  evidenceIds: string[];
  fusionScore: number;
  keywordRank?: number;
  vectorRank?: number;
};

export type RetrievalMode = "HYBRID" | "KEYWORD_FALLBACK";

export type EvidencePack = {
  allowedEvidenceIds: string[];
  coverage: { retrievedChunks: number; warnings: string[] };
  evidences: Evidence[];
  facts: Array<{ programId: string; text: string }>;
  programId: string;
  sourceDocuments: Pick<
    SourceDocument,
    "admissionYear" | "id" | "sourceTrust" | "sourceType" | "title"
  >[];
};
