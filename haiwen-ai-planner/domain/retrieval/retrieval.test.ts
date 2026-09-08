import { describe, expect, it } from "vitest";
import {
  fixtureEvidence,
  fixtureSourceDocuments,
} from "@/domain/school/fixtures";
import { createFakeEmbeddingProvider } from "@/lib/ai/embedding-provider";
import { chunkSourceDocument } from "./chunking";
import { embedChunks } from "./embedding-cache";
import { reciprocalRankFusion } from "./hybrid";
import { InMemoryRetrievalRepository } from "./in-memory-repository";
import { hybridRetrieve } from "./pipeline";

describe("hybrid retrieval", () => {
  it("chunks deterministically and caches embeddings by model", async () => {
    const source = fixtureSourceDocuments.find(
      (item) => item.id === "src-east-cs-2026"
    );
    if (!source) {
      throw new Error("Expected source fixture");
    }
    const chunks = chunkSourceDocument(source, {
      maxCharacters: 40,
      programId: "prog-east-cs",
    });
    expect(
      chunkSourceDocument(source, {
        maxCharacters: 40,
        programId: "prog-east-cs",
      })
    ).toEqual(chunks);
    const repository = new InMemoryRetrievalRepository();
    await repository.saveChunks(chunks);
    const provider = createFakeEmbeddingProvider();
    const first = await embedChunks(chunks, provider, repository);
    const second = await embedChunks(chunks, provider, repository);
    const changedModel = await embedChunks(
      chunks,
      createFakeEmbeddingProvider("fake-v2"),
      repository
    );
    expect(second).toEqual(first);
    expect(changedModel.every((item) => item.model === "fake-v2")).toBe(true);
  });

  it("fuses keyword and vector ranks deterministically and filters year/program", async () => {
    const source = fixtureSourceDocuments.find(
      (item) => item.id === "src-east-cs-2026"
    );
    if (!source) {
      throw new Error("Expected source fixture");
    }
    const chunks = chunkSourceDocument(source, { programId: "prog-east-cs" });
    const repository = new InMemoryRetrievalRepository();
    await repository.saveChunks(chunks);
    const provider = createFakeEmbeddingProvider("runtime");
    await embedChunks(chunks, provider, repository);
    const result = await hybridRetrieve({
      embed: provider.embed,
      evidence: fixtureEvidence,
      query: {
        admissionYear: 2026,
        programIds: ["prog-east-cs"],
        text: "计算机 2026",
      },
      repository,
    });
    expect(result.mode).toBe("HYBRID");
    expect(
      result.retrievedChunks.every(
        (item) =>
          item.chunk.admissionYear === 2026 &&
          item.chunk.programId === "prog-east-cs"
      )
    ).toBe(true);
    const fallback = await hybridRetrieve({
      evidence: fixtureEvidence,
      query: { admissionYear: 2025, programIds: ["wrong"], text: "计算机" },
      repository,
    });
    expect(fallback).toEqual({ mode: "KEYWORD_FALLBACK", retrievedChunks: [] });
  });

  it("uses stable reciprocal-rank fusion", () => {
    const chunks = new Map([
      ["a", { chunk: { id: "a" }, evidenceIds: [], fusionScore: 0 } as never],
      ["b", { chunk: { id: "b" }, evidenceIds: [], fusionScore: 0 } as never],
    ]);
    expect(
      reciprocalRankFusion(
        [{ chunkId: "a" }],
        [{ chunkId: "b" }, { chunkId: "a" }],
        chunks
      ).map((item) => item.chunk.id)
    ).toEqual(["a", "b"]);
  });
});
