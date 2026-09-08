import type { Evidence, SourceDocument } from "@/domain/evidence/models";
import { hybridRetrievalConfig, reciprocalRankFusion } from "./hybrid";
import type {
  EvidencePack,
  RetrievalMode,
  RetrievalQuery,
  RetrievedChunk,
} from "./models";
import type { RetrievalRepository } from "./repository";

export async function hybridRetrieve(input: {
  embed?: (values: string[]) => Promise<number[][]>;
  evidence: readonly Evidence[];
  query: RetrievalQuery;
  repository: RetrievalRepository;
}): Promise<{ mode: RetrievalMode; retrievedChunks: RetrievedChunk[] }> {
  const filters = {
    admissionYear: input.query.admissionYear,
    limit: hybridRetrievalConfig.keywordLimit,
    programIds: input.query.programIds,
  };
  const keyword = await input.repository.keywordSearchChunks(
    input.query.text,
    filters
  );
  const initial = new Map(
    keyword.map((chunk) => [
      chunk.id,
      {
        chunk,
        evidenceIds: evidenceIds(chunk, input.evidence),
        fusionScore: 0,
      } satisfies RetrievedChunk,
    ])
  );
  if (!input.embed) {
    return {
      mode: "KEYWORD_FALLBACK",
      retrievedChunks: reciprocalRankFusion(
        keyword.map(({ id: chunkId }) => ({ chunkId })),
        [],
        initial
      ),
    };
  }
  try {
    const [queryEmbedding] = await input.embed([input.query.text]);
    if (!queryEmbedding) {
      throw new Error("Embedding result missing");
    }
    const vector = await input.repository.vectorSearchChunks(
      queryEmbedding,
      "runtime",
      { ...filters, limit: hybridRetrievalConfig.vectorLimit }
    );
    for (const chunk of vector) {
      if (!initial.has(chunk.id)) {
        initial.set(chunk.id, {
          chunk,
          evidenceIds: evidenceIds(chunk, input.evidence),
          fusionScore: 0,
        });
      }
    }
    return {
      mode: "HYBRID",
      retrievedChunks: reciprocalRankFusion(
        keyword.map(({ id: chunkId }) => ({ chunkId })),
        vector.map(({ id: chunkId }) => ({ chunkId })),
        initial
      ),
    };
  } catch {
    return {
      mode: "KEYWORD_FALLBACK",
      retrievedChunks: reciprocalRankFusion(
        keyword.map(({ id: chunkId }) => ({ chunkId })),
        [],
        initial
      ),
    };
  }
}

export function buildEvidencePack(input: {
  evidences: Evidence[];
  retrievedChunks: RetrievedChunk[];
  sourceDocuments: SourceDocument[];
  programId: string;
}): EvidencePack {
  const ids = [
    ...new Set(input.retrievedChunks.flatMap((chunk) => chunk.evidenceIds)),
  ].sort();
  return {
    allowedEvidenceIds: ids,
    coverage: {
      retrievedChunks: input.retrievedChunks.length,
      warnings: ids.length ? [] : ["LIMITED_RETRIEVAL_EVIDENCE"],
    },
    evidences: input.evidences.filter((item) => ids.includes(item.id)),
    facts: input.retrievedChunks.map((item) => ({
      programId: item.chunk.programId ?? input.programId,
      text: item.chunk.content,
    })),
    programId: input.programId,
    sourceDocuments: input.sourceDocuments
      .filter((source) =>
        input.retrievedChunks.some(
          (chunk) => chunk.chunk.sourceDocumentId === source.id
        )
      )
      .map(({ admissionYear, id, sourceTrust, sourceType, title }) => ({
        admissionYear,
        id,
        sourceTrust,
        sourceType,
        title,
      })),
  };
}

function evidenceIds(
  chunk: RetrievedChunk["chunk"],
  evidence: readonly Evidence[]
) {
  return evidence
    .filter(
      (item) =>
        item.sourceDocumentId === chunk.sourceDocumentId &&
        (!chunk.programId || item.programId === chunk.programId)
    )
    .map((item) => item.id);
}
