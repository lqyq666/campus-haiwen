import { describe, expect, it } from "vitest";
import { computeContentHash } from "./integrity";
import { toVerifiedEvidence } from "./metadata";
import type { Evidence, SourceDocument } from "./models";

const excerpt = "CET6 不低于 500 分。";
const evidence: Evidence = {
  contentHash: computeContentHash(excerpt),
  createdAt: "2026-08-30T00:00:00.000Z",
  evidenceType: "ELIGIBILITY",
  excerpt,
  id: "evidence-1",
  programId: "program-1",
  sourceDocumentId: "source-1",
};
const source: SourceDocument = {
  admissionYear: 2026,
  contentHash: "document-hash",
  createdAt: "2026-08-30T00:00:00.000Z",
  fetchedAt: "2026-08-30T00:00:00.000Z",
  id: "source-1",
  rawText: `招生要求：${excerpt}`,
  sourceTrust: "OFFICIAL",
  sourceType: "OFFICIAL_ADMISSION_NOTICE",
  sourceUrl: "https://yz.example.edu.cn/notice",
  title: "2026 招生通知",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

describe("deterministic evidence metadata", () => {
  it("derives relevance, freshness, and strength from verified source facts", () => {
    expect(
      toVerifiedEvidence(evidence, source, {
        latestOfficialYear: 2026,
        targetAdmissionYear: 2027,
      })
    ).toMatchObject({
      freshness: "LATEST_OFFICIAL_HISTORICAL",
      relevance: "DIRECT",
      strength: "HIGH",
      verified: true,
    });
    expect(
      toVerifiedEvidence(evidence, source, {
        latestOfficialYear: 2027,
        targetAdmissionYear: 2027,
      })?.freshness
    ).toBe("OUTDATED");
  });

  it("rejects missing, malformed, or non-official source chains", () => {
    expect(
      toVerifiedEvidence(evidence, undefined, {
        latestOfficialYear: 2026,
        targetAdmissionYear: 2027,
      })
    ).toBeUndefined();
    expect(
      toVerifiedEvidence(
        evidence,
        { ...source, sourceUrl: "javascript:alert(1)" },
        { latestOfficialYear: 2026, targetAdmissionYear: 2027 }
      )
    ).toBeUndefined();
    expect(
      toVerifiedEvidence(
        evidence,
        { ...source, sourceTrust: "UNKNOWN" },
        { latestOfficialYear: 2026, targetAdmissionYear: 2027 }
      )
    ).toBeUndefined();
  });
});
