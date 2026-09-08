import { describe, expect, it } from "vitest";
import { computeContentHash, verifyEvidenceSpan } from "../evidence/integrity";
import { fixtureEvidence, fixtureSourceDocuments } from "./fixtures";
import {
  InMemoryEvidenceRepository,
  InMemorySchoolRepository,
} from "./in-memory-repository";

const schools = new InMemorySchoolRepository();
const evidence = new InMemoryEvidenceRepository();

describe("school data retrieval", () => {
  it("finds one exact city, major, and year candidate", async () => {
    const result = await schools.findProgramCandidates({
      admissionYear: 2026,
      targetCities: ["上海"],
      targetMajors: ["计算机科学与技术"],
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.program.id).toBe("prog-east-cs");
  });

  it("supports multiple candidates and empty filters", async () => {
    const shanghai = await schools.findProgramCandidates({
      admissionYear: 2026,
      targetCities: ["上海"],
    });
    const broad = await schools.findProgramCandidates({ admissionYear: 2026 });
    expect(shanghai.candidates.length).toBeGreaterThan(1);
    expect(broad.candidates.length).toBeGreaterThan(shanghai.candidates.length);
    expect(broad.missingCriteria).toContain("targetMajors");
  });

  it("keeps 2025 and 2026 policy facts separate", async () => {
    const policy2025 = await schools.getAdmissionPolicy("prog-east-cs", 2025);
    const policy2026 = await schools.getAdmissionPolicy("prog-east-cs", 2026);
    expect(policy2025?.examSubjects.at(-1)?.name).toBe("专业基础 A");
    expect(policy2026?.examSubjects.at(-1)?.name).toBe("专业基础 B");
  });

  it("links summer camp policy to evidence", async () => {
    const policies = await schools.getRecommendationPolicies(
      "prog-east-cs",
      2026
    );
    const matches = await evidence.searchEvidence({
      admissionYear: 2026,
      keywords: ["CET6"],
      programIds: ["prog-east-cs"],
    });
    expect(policies[0]?.stage).toBe("SUMMER_CAMP");
    expect(matches[0]?.id).toBe("EV-000004");
    expect(matches[0]?.sourceDocumentId).toBe(policies[0]?.sourceDocumentId);
  });
});

describe("evidence integrity", () => {
  it("rejects an excerpt that is absent from source raw text", () => {
    const [source] = fixtureSourceDocuments;
    expect(
      verifyEvidenceSpan(
        {
          contentHash: computeContentHash("不存在的原文"),
          excerpt: "不存在的原文",
        },
        source
      )
    ).toEqual({ reason: "EXCERPT_NOT_FOUND", valid: false });
  });

  it("accepts safe whitespace normalization", () => {
    const source = fixtureSourceDocuments.find(
      (item) => item.id === "src-east-summer-2026"
    );
    const excerpt = "报名时间为 2026 年 6 月 1 日至 6 月 15 日。";
    expect(
      verifyEvidenceSpan(
        { contentHash: computeContentHash(excerpt), excerpt },
        source ?? { rawText: undefined }
      )
    ).toEqual({ valid: true });
  });

  it("keeps stable citation ids and deterministic hashes", () => {
    expect(fixtureEvidence.every((item) => /^EV-\d{6}$/.test(item.id))).toBe(
      true
    );
    expect(computeContentHash("a  b")).toBe(computeContentHash("a\nb"));
  });
});
