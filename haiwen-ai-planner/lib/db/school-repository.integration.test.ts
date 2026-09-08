import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeContentHash } from "@/domain/evidence/integrity";
import {
  fixtureEvidence,
  fixtureSourceDocuments,
} from "@/domain/school/fixtures";
import { createSchoolDataRepositories } from "@/lib/repositories/school-data";
import { PostgresRetrievalRepository } from "./retrieval-repository";
import { PostgresSchoolDataRepository } from "./school-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

integration("PostgreSQL school repository", () => {
  const sql = postgres(databaseUrl ?? "postgresql://invalid");
  const repository = new PostgresSchoolDataRepository(sql);

  beforeAll(async () => {
    await sql`TRUNCATE evidences, recommendation_policies, admission_policies,
      source_documents, programs, departments, universities CASCADE`;
    await repository.seedFixtures();
  });

  afterAll(async () => {
    await sql.end();
  });

  it("inserts fixtures and filters candidates by year", async () => {
    const result = await repository.findProgramCandidates({
      admissionYear: 2026,
      targetCities: ["上海"],
      targetMajors: ["计算机科学与技术"],
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.admissionPolicy?.admissionYear).toBe(2026);
    expect(
      result.candidates[0]?.evidence.some((item) => item.id === "EV-000002")
    ).toBe(true);
    expect(
      result.candidates[0]?.evidence.some((item) => item.id === "EV-000001")
    ).toBe(false);
  });

  it("preserves historical policy versions", async () => {
    const oldPolicy = await repository.getAdmissionPolicy("prog-east-cs", 2025);
    const currentPolicy = await repository.getAdmissionPolicy(
      "prog-east-cs",
      2026
    );
    expect(oldPolicy?.examSubjects.at(-1)?.name).toBe("专业基础 A");
    expect(currentPolicy?.examSubjects.at(-1)?.name).toBe("专业基础 B");
  });

  it("enforces foreign keys", async () => {
    await expect(
      sql`INSERT INTO departments (id, university_id, name)
        VALUES ('broken-department', 'missing-university', 'Broken')`
    ).rejects.toThrow();
  });

  it("deduplicates source documents by canonical URL and content hash", async () => {
    const [source] = fixtureSourceDocuments;
    const duplicate = { ...source, id: "duplicate-source-id" };
    const stored = await repository.upsertSourceDocument(duplicate);
    const rows = await sql<{ count: string }[]>`SELECT count(*)::text AS count
      FROM source_documents WHERE canonical_url = ${source.canonicalUrl ?? source.sourceUrl}
      AND content_hash = ${source.contentHash}`;
    expect(stored?.id).toBe(source.id);
    expect(rows[0]?.count).toBe("1");
  });

  it("rejects invalid evidence before insert", async () => {
    const invalid = {
      ...fixtureEvidence[0],
      contentHash: computeContentHash("not in source"),
      excerpt: "not in source",
      id: "EV-999999",
    };
    await expect(repository.insertEvidence(invalid)).rejects.toThrow(
      "Invalid evidence: EXCERPT_NOT_FOUND"
    );
  });

  it("provides PostgreSQL-backed runtime repositories without fixture fallback", async () => {
    const runtime = createSchoolDataRepositories({
      POSTGRES_URL: databaseUrl,
      SCHOOL_DATA_SOURCE: "postgres",
    });
    try {
      const result = await runtime.schoolRepository.findProgramCandidates({
        admissionYear: 2026,
        targetCities: ["上海"],
        targetMajors: ["计算机"],
      });
      const evidence = await runtime.evidenceRepository.searchEvidence({
        admissionYear: 2026,
        keywords: [],
        programIds: ["prog-east-cs"],
      });
      expect(result.candidates[0]?.program.id).toBe("prog-east-cs");
      expect(evidence.some((item) => item.id === "EV-000004")).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it("stores and searches pgvector retrieval records with structured filters", async () => {
    const retrieval = new PostgresRetrievalRepository(sql);
    await retrieval.saveChunks([
      {
        admissionYear: 2026,
        chunkIndex: 0,
        content: "计算机 2026 测试招生政策",
        contentHash: "chunk-hash",
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "chunk-east-cs",
        normalizedContent: "计算机 2026 测试招生政策",
        programId: "prog-east-cs",
        sourceDocumentId: "src-east-cs-2026",
      },
    ]);
    await retrieval.saveEmbeddings([
      {
        chunkId: "chunk-east-cs",
        contentHash: "chunk-hash",
        createdAt: "2026-01-01T00:00:00.000Z",
        dimensions: 4,
        embedding: [1, 0, 0, 0],
        model: "runtime",
      },
    ]);
    const filters = {
      admissionYear: 2026,
      limit: 5,
      programIds: ["prog-east-cs"],
    };
    expect(
      (await retrieval.keywordSearchChunks("计算机", filters))[0]?.id
    ).toBe("chunk-east-cs");
    expect(
      (await retrieval.vectorSearchChunks([1, 0, 0, 0], "runtime", filters))[0]
        ?.id
    ).toBe("chunk-east-cs");
    expect(
      await retrieval.keywordSearchChunks("计算机", {
        ...filters,
        admissionYear: 2025,
      })
    ).toEqual([]);
  });
});
