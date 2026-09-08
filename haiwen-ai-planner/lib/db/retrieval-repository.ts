import type postgres from "postgres";
import type { DocumentChunk, EmbeddingRecord } from "@/domain/retrieval/models";
import type {
  ChunkSearchFilters,
  RetrievalRepository,
} from "@/domain/retrieval/repository";

type Sql = ReturnType<typeof postgres>;

export class PostgresRetrievalRepository implements RetrievalRepository {
  private readonly sql: Sql;
  constructor(sql: Sql) {
    this.sql = sql;
  }
  async getEmbedding(chunkId: string, model: string) {
    const rows = await this.sql<
      EmbeddingRecord[]
    >`SELECT chunk_id AS "chunkId", content_hash AS "contentHash", created_at AS "createdAt", dimensions, embedding::text AS embedding, model FROM embedding_records WHERE chunk_id = ${chunkId} AND model = ${model}`;
    const [row] = rows;
    return row
      ? { ...row, embedding: parseVector(row.embedding as unknown as string) }
      : undefined;
  }
  async saveChunks(chunks: DocumentChunk[]) {
    await Promise.all(
      chunks.map(
        (chunk) =>
          this
            .sql`INSERT INTO document_chunks (id, source_document_id, program_id, admission_year, chunk_index, content, normalized_content, content_hash, created_at) VALUES (${chunk.id}, ${chunk.sourceDocumentId}, ${chunk.programId ?? null}, ${chunk.admissionYear ?? null}, ${chunk.chunkIndex}, ${chunk.content}, ${chunk.normalizedContent}, ${chunk.contentHash}, ${chunk.createdAt}) ON CONFLICT DO NOTHING`
      )
    );
  }
  async saveEmbeddings(records: EmbeddingRecord[]) {
    await Promise.all(
      records.map(
        (record) =>
          this
            .sql`INSERT INTO embedding_records (chunk_id, model, dimensions, content_hash, embedding, created_at) VALUES (${record.chunkId}, ${record.model}, ${record.dimensions}, ${record.contentHash}, ${vector(record.embedding)}, ${record.createdAt}) ON CONFLICT (chunk_id, model) DO NOTHING`
      )
    );
  }
  async keywordSearchChunks(query: string, filters: ChunkSearchFilters) {
    const terms = query.split(/\s+/).filter(Boolean);
    const rows = await this.sql<
      DocumentChunk[]
    >`SELECT id, source_document_id AS "sourceDocumentId", program_id AS "programId", admission_year AS "admissionYear", chunk_index AS "chunkIndex", content, normalized_content AS "normalizedContent", content_hash AS "contentHash", created_at AS "createdAt" FROM document_chunks WHERE admission_year = ${filters.admissionYear} AND (cardinality(${filters.programIds}::text[]) = 0 OR program_id = ANY(${filters.programIds}::text[])) AND (${terms.join(" ")} = '' OR normalized_content ILIKE ${`%${terms.join("%")}%`}) ORDER BY id LIMIT ${filters.limit}`;
    return rows;
  }
  vectorSearchChunks(
    embedding: number[],
    model: string,
    filters: ChunkSearchFilters
  ) {
    return this.sql<
      DocumentChunk[]
    >`SELECT c.id, c.source_document_id AS "sourceDocumentId", c.program_id AS "programId", c.admission_year AS "admissionYear", c.chunk_index AS "chunkIndex", c.content, c.normalized_content AS "normalizedContent", c.content_hash AS "contentHash", c.created_at AS "createdAt" FROM document_chunks c JOIN embedding_records e ON e.chunk_id = c.id AND e.model = ${model} WHERE c.admission_year = ${filters.admissionYear} AND (cardinality(${filters.programIds}::text[]) = 0 OR c.program_id = ANY(${filters.programIds}::text[])) ORDER BY e.embedding <=> ${vector(embedding)} LIMIT ${filters.limit}`;
  }
}

function vector(values: number[]) {
  return `[${values.join(",")}]`;
}
function parseVector(value: string) {
  return value.slice(1, -1).split(",").filter(Boolean).map(Number);
}
