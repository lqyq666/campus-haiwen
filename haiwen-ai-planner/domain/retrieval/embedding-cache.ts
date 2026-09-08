import type { EmbeddingProvider } from "@/lib/ai/embedding-provider";
import type { DocumentChunk, EmbeddingRecord } from "./models";
import type { RetrievalRepository } from "./repository";

export async function embedChunks(
  chunks: readonly DocumentChunk[],
  provider: EmbeddingProvider,
  repository: RetrievalRepository
): Promise<EmbeddingRecord[]> {
  const cached = await Promise.all(
    chunks.map((chunk) => repository.getEmbedding(chunk.id, provider.model))
  );
  const missing = chunks.filter((_, index) => !cached[index]);
  if (missing.length) {
    const vectors = await provider.embed(
      missing.map((chunk) => chunk.normalizedContent)
    );
    const records = missing.map((chunk, index) => ({
      chunkId: chunk.id,
      contentHash: chunk.contentHash,
      createdAt: chunk.createdAt,
      dimensions: vectors[index]?.length ?? 0,
      embedding: vectors[index] ?? [],
      model: provider.model,
    }));
    await repository.saveEmbeddings(records);
  }
  return (
    await Promise.all(
      chunks.map((chunk) => repository.getEmbedding(chunk.id, provider.model))
    )
  ).filter((record): record is EmbeddingRecord => Boolean(record));
}
