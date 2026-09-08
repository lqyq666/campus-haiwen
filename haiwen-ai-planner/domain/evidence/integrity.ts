import { createHash } from "node:crypto";
import type { Evidence, SourceDocument } from "./models";

export function normalizeEvidenceText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function computeContentHash(value: string) {
  return createHash("sha256")
    .update(normalizeEvidenceText(value), "utf8")
    .digest("hex");
}

export function sourceDocumentDedupeKey(document: SourceDocument) {
  return `${document.canonicalUrl ?? document.sourceUrl}::${document.contentHash}`;
}

export type EvidenceVerification = {
  reason?:
    | "EMPTY_EXCERPT"
    | "RAW_TEXT_MISSING"
    | "EXCERPT_NOT_FOUND"
    | "HASH_MISMATCH";
  valid: boolean;
};

export function verifyEvidenceSpan(
  evidence: Pick<Evidence, "contentHash" | "excerpt">,
  sourceDocument: Pick<SourceDocument, "rawText">
): EvidenceVerification {
  const normalizedExcerpt = normalizeEvidenceText(evidence.excerpt);
  if (!normalizedExcerpt) {
    return { reason: "EMPTY_EXCERPT", valid: false };
  }
  if (!sourceDocument.rawText) {
    return { reason: "RAW_TEXT_MISSING", valid: false };
  }
  if (computeContentHash(evidence.excerpt) !== evidence.contentHash) {
    return { reason: "HASH_MISMATCH", valid: false };
  }
  const normalizedSource = normalizeEvidenceText(sourceDocument.rawText);
  if (!normalizedSource.includes(normalizedExcerpt)) {
    return { reason: "EXCERPT_NOT_FOUND", valid: false };
  }
  return { valid: true };
}
