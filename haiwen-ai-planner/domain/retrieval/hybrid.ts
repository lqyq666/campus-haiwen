import type { RetrievalQuery, RetrievedChunk } from "./models";

export const hybridRetrievalConfig = {
  finalLimit: 8,
  keywordLimit: 12,
  rrfK: 60,
  vectorLimit: 12,
  version: "hybrid-retrieval-v0.1",
} as const;

export function buildRetrievalQuery(input: {
  admissionYear: number;
  path: string;
  programIds: string[];
  targetMajors: string[];
}): RetrievalQuery {
  return {
    admissionYear: input.admissionYear,
    programIds: [...input.programIds].sort(),
    text: [...input.targetMajors, input.path, String(input.admissionYear)]
      .filter(Boolean)
      .join(" "),
  };
}

export function reciprocalRankFusion(
  keyword: Array<{ chunkId: string }>,
  vector: Array<{ chunkId: string }>,
  chunks: Map<string, RetrievedChunk>
): RetrievedChunk[] {
  for (const [index, item] of keyword.entries()) {
    const current = chunks.get(item.chunkId);
    if (current) {
      current.keywordRank = index + 1;
      current.fusionScore += 1 / (hybridRetrievalConfig.rrfK + index + 1);
    }
  }
  for (const [index, item] of vector.entries()) {
    const current = chunks.get(item.chunkId);
    if (current) {
      current.vectorRank = index + 1;
      current.fusionScore += 1 / (hybridRetrievalConfig.rrfK + index + 1);
    }
  }
  return [...chunks.values()]
    .filter((item) => item.fusionScore > 0)
    .sort(
      (left, right) =>
        right.fusionScore - left.fusionScore ||
        left.chunk.id.localeCompare(right.chunk.id)
    )
    .slice(0, hybridRetrievalConfig.finalLimit);
}
