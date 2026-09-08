import type { DocumentChunk, EmbeddingRecord } from "./models";

export type ChunkSearchFilters = {
  admissionYear: number;
  limit: number;
  programIds: string[];
};

export interface RetrievalRepository {
  getEmbedding: (
    chunkId: string,
    model: string
  ) => Promise<EmbeddingRecord | undefined>;
  keywordSearchChunks: (
    query: string,
    filters: ChunkSearchFilters
  ) => Promise<DocumentChunk[]>;
  saveChunks: (chunks: DocumentChunk[]) => Promise<void>;
  saveEmbeddings: (records: EmbeddingRecord[]) => Promise<void>;
  vectorSearchChunks: (
    embedding: number[],
    model: string,
    filters: ChunkSearchFilters
  ) => Promise<DocumentChunk[]>;
}
