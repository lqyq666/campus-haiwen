import {
  computeContentHash,
  normalizeEvidenceText,
} from "@/domain/evidence/integrity";
import type { SourceDocument } from "@/domain/evidence/models";
import type { DocumentChunk } from "./models";

export function chunkSourceDocument(
  source: SourceDocument,
  options: { maxCharacters?: number; overlap?: number; programId?: string } = {}
): DocumentChunk[] {
  const maxCharacters = options.maxCharacters ?? 500;
  const overlap = options.overlap ?? 60;
  const normalized = normalizeEvidenceText(source.rawText ?? "");
  if (!normalized) {
    return [];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maxCharacters, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf("。", end);
      if (boundary > start + Math.floor(maxCharacters / 2)) {
        end = boundary + 1;
      }
    }
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.map((content, chunkIndex) => ({
    admissionYear: source.admissionYear,
    chunkIndex,
    content,
    contentHash: computeContentHash(content),
    createdAt: source.createdAt,
    id: `${source.id}:chunk:${chunkIndex}`,
    normalizedContent: normalizeEvidenceText(content),
    programId: options.programId,
    sourceDocumentId: source.id,
  }));
}
