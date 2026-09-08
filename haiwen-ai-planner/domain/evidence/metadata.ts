import { verifyEvidenceSpan } from "./integrity";
import type {
  Evidence,
  EvidenceFreshness,
  EvidenceRelevance,
  EvidenceStrength,
  SourceDocument,
  VerifiedEvidence,
} from "./models";

export function toVerifiedEvidence(
  evidence: Evidence,
  source: SourceDocument | undefined,
  context: { latestOfficialYear?: number; targetAdmissionYear: number }
): VerifiedEvidence | undefined {
  if (
    !source ||
    source.id !== evidence.sourceDocumentId ||
    !isTrustedSourceDocument(source) ||
    !verifyEvidenceSpan(evidence, source).valid
  ) {
    return;
  }
  const relevance = evidenceRelevance(evidence.evidenceType);
  return {
    ...evidence,
    freshness: evidenceFreshness(
      source.admissionYear,
      context.targetAdmissionYear,
      context.latestOfficialYear
    ),
    relevance,
    strength: evidenceStrength(source, relevance),
    verified: true,
  };
}

export function isOfficialSourceDocument(source: SourceDocument) {
  return source.sourceTrust === "OFFICIAL" && hasValidSourceUrl(source);
}

function isTrustedSourceDocument(source: SourceDocument) {
  if (
    source.sourceTrust !== "OFFICIAL" &&
    source.sourceTrust !== "TEST_FIXTURE"
  ) {
    return false;
  }
  return hasValidSourceUrl(source);
}

function hasValidSourceUrl(source: SourceDocument) {
  try {
    const url = new URL(source.canonicalUrl ?? source.sourceUrl);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function evidenceRelevance(type: Evidence["evidenceType"]): EvidenceRelevance {
  if (
    type === "ELIGIBILITY" ||
    type === "APPLICATION_WINDOW" ||
    type === "EXAM_SUBJECT" ||
    type === "ENROLLMENT"
  ) {
    return "DIRECT";
  }
  return type === "POLICY_TEXT" ? "SUPPORTING" : "CONTEXTUAL";
}

function evidenceFreshness(
  sourceYear: number | undefined,
  targetYear: number,
  latestOfficialYear: number | undefined
): EvidenceFreshness {
  if (sourceYear === undefined || sourceYear > targetYear) {
    return "UNKNOWN";
  }
  if (sourceYear === targetYear) {
    return "CURRENT";
  }
  return sourceYear === latestOfficialYear
    ? "LATEST_OFFICIAL_HISTORICAL"
    : "OUTDATED";
}

function evidenceStrength(
  source: SourceDocument,
  relevance: EvidenceRelevance
): EvidenceStrength {
  if (source.sourceTrust !== "OFFICIAL") {
    return "LOW";
  }
  return relevance === "DIRECT"
    ? "HIGH"
    : relevance === "SUPPORTING"
      ? "MEDIUM"
      : "LOW";
}
