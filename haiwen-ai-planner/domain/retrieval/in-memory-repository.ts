import type { DocumentChunk, EmbeddingRecord } from "./models";
import type { ChunkSearchFilters, RetrievalRepository } from "./repository";

export class InMemoryRetrievalRepository implements RetrievalRepository {
  private readonly chunks = new Map<string, DocumentChunk>();
  private readonly embeddings = new Map<string, EmbeddingRecord>();

  getEmbedding(chunkId: string, model: string) {
    return Promise.resolve(this.embeddings.get(`${chunkId}:${model}`));
  }
  saveChunks(chunks: DocumentChunk[]) {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
    return Promise.resolve();
  }
  saveEmbeddings(records: EmbeddingRecord[]) {
    for (const record of records) {
      this.embeddings.set(`${record.chunkId}:${record.model}`, record);
    }
    return Promise.resolve();
  }
  keywordSearchChunks(query: string, filters: ChunkSearchFilters) {
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return Promise.resolve(
      this.filtered(filters)
        .filter((chunk) =>
          terms.some((term) =>
            chunk.normalizedContent.toLocaleLowerCase().includes(term)
          )
        )
        .slice(0, filters.limit)
    );
  }
  vectorSearchChunks(
    embedding: number[],
    model: string,
    filters: ChunkSearchFilters
  ) {
    return Promise.resolve(
      this.filtered(filters)
        .map((chunk) => ({
          chunk,
          score: cosine(
            embedding,
            this.embeddings.get(`${chunk.id}:${model}`)?.embedding ?? []
          ),
        }))
        .filter((item) => item.score > Number.NEGATIVE_INFINITY)
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.chunk.id.localeCompare(right.chunk.id)
        )
        .slice(0, filters.limit)
        .map((item) => item.chunk)
    );
  }
  private filtered(filters: ChunkSearchFilters) {
    return [...this.chunks.values()].filter(
      (chunk) =>
        chunk.admissionYear === filters.admissionYear &&
        (!filters.programIds.length ||
          (chunk.programId && filters.programIds.includes(chunk.programId)))
    );
  }
}

function cosine(left: number[], right: number[]) {
  if (!(left.length && left.length === right.length)) {
    return Number.NEGATIVE_INFINITY;
  }
  const denominator = Math.hypot(...left) * Math.hypot(...right);
  return denominator
    ? left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0) /
        denominator
    : Number.NEGATIVE_INFINITY;
}
