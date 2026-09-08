import { describe, expect, it } from "vitest";
import { createAssessmentResult } from "@/domain/assessment/result";
import {
  fixtureEvidence,
  fixtureSourceDocuments,
} from "@/domain/school/fixtures";
import { InMemorySchoolRepository } from "@/domain/school/in-memory-repository";
import { parseStudentProfile } from "@/domain/student/schema";
import { matchSchoolCandidates, rankSchoolMatches } from "./matching";
import { normalizeSchoolMatchTier } from "./models";
import {
  createActionPriorities,
  createAssessmentReport,
  validateAssessmentReport,
} from "./report";
import { serializeAssessmentReport } from "./serialization";

const schools = new InMemorySchoolRepository();

describe("deterministic school matching", () => {
  it("matches a strong profile with a supported program deterministically", async () => {
    const input = await matchingInput(560);
    const first = matchSchoolCandidates(input);
    const second = matchSchoolCandidates(input);
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      eligibility: "PASS",
      programId: "prog-east-cs",
      scoringVersion: "school-matching-v0.1",
    });
    expect(first[0]?.score).toBeGreaterThan(0);
    expect(first[0]?.confidence).toBeGreaterThan(0);
    expect(first[0]).toMatchObject({
      confidenceLevel: expect.stringMatching(/^(HIGH|MEDIUM|LOW)$/),
      matchingVersion: "program-matching-v0.2",
      programName: "计算机科学与技术",
      rulesVersion: "rules-v0.2",
      schoolDataVersion: "school-data-fixture-v0.1",
      schoolId: "uni-east",
    });
    expect(first[0]?.positiveFactors).toEqual(first[0]?.reasons);
    expect(first[0]?.riskFactors).toEqual(first[0]?.riskFlags);
  });

  it("normalizes legacy SAFE tiers to canonical CONSERVATIVE", () => {
    expect(normalizeSchoolMatchTier("SAFE")).toBe("CONSERVATIVE");
    expect(normalizeSchoolMatchTier("CONSERVATIVE")).toBe("CONSERVATIVE");
  });

  it("marks an unmet explicit CET6 requirement as a hard mismatch", async () => {
    const [result] = matchSchoolCandidates(await matchingInput(460));
    expect(result?.eligibility).toBe("FAIL");
    expect(result?.tier).toBe("INSUFFICIENT_DATA");
    expect(result?.riskFlags.map((risk) => risk.code)).toContain(
      "HARD_POLICY_MISMATCH"
    );
  });

  it("keeps a weaker profile below the strong-profile matching score", async () => {
    const strong = matchSchoolCandidates(await matchingInput(560));
    const weak = matchSchoolCandidates(
      await matchingInput(560, "BALANCED", { dailyStudyHours: 1, rank: 55 })
    );
    expect(firstRecommendation(weak).score).toBeLessThan(
      firstRecommendation(strong).score
    );
  });

  it("keeps an unquantified or missing English requirement unknown", async () => {
    const input = await matchingInput(undefined);
    const [result] = matchSchoolCandidates(input);
    expect(result?.eligibility).toBe("UNKNOWN");
    expect(result?.riskFlags.map((risk) => risk.code)).toContain(
      "ENGLISH_REQUIREMENT_UNKNOWN"
    );
  });

  it("does not substitute a historical policy for the requested admission year", async () => {
    const input = await matchingInput(560);
    const candidate = {
      ...firstCandidate(input),
      admissionPolicy: await schools.getAdmissionPolicy("prog-east-cs", 2025),
      recommendationPolicies: [],
    };
    const [result] = matchSchoolCandidates({
      ...input,
      candidates: [candidate],
    });
    expect(result?.tier).toBe("INSUFFICIENT_DATA");
    expect(result?.riskFlags.map((risk) => risk.code)).toContain(
      "POLICY_DATA_MISSING"
    );
  });

  it("lowers evidence quality when policy evidence is missing", async () => {
    const input = await matchingInput(560);
    const candidate = { ...firstCandidate(input), evidence: [] };
    const [result] = matchSchoolCandidates({
      ...input,
      candidates: [candidate],
    });
    expect(result?.dimensions.evidenceQuality).toBe(0);
    expect(result?.riskFlags.map((risk) => risk.code)).toContain(
      "LIMITED_EVIDENCE"
    );
  });

  it("applies controlled risk preference thresholds without changing hard eligibility", async () => {
    const balanced = await matchingInput(560, "BALANCED");
    const aggressive = await matchingInput(560, "AGGRESSIVE");
    const conservative = await matchingInput(560, "CONSERVATIVE");
    const scores = [balanced, aggressive, conservative].map(
      (input) => matchSchoolCandidates(input)[0]?.score
    );
    expect(new Set(scores).size).toBe(1);
    expect(
      matchSchoolCandidates(await matchingInput(460, "AGGRESSIVE"))[0]?.tier
    ).toBe("INSUFFICIENT_DATA");
  });

  it("uses stable ranking and program id as a tie-breaker", async () => {
    const [match] = matchSchoolCandidates(await matchingInput(560));
    if (!match) {
      throw new Error("Expected a match fixture");
    }
    const tied = [
      { ...match, programId: "prog-z" },
      { ...match, programId: "prog-a" },
    ];
    expect(rankSchoolMatches(tied).map((item) => item.programId)).toEqual([
      "prog-a",
      "prog-z",
    ]);
  });
});

describe("assessment report contract", () => {
  it("validates report evidence references and deterministic action priorities", async () => {
    const input = await matchingInput(460);
    const recommendations = matchSchoolCandidates(input);
    const priorities = createActionPriorities(recommendations, input.profile);
    const report = createAssessmentReport({
      actionPriorities: priorities,
      admissionYear: input.admissionYear,
      assessmentResult: input.assessmentResult,
      evidence: input.evidence,
      generatedAt: new Date("2026-01-01T00:00:00.000Z"),
      profile: input.profile,
      schoolRecommendations: recommendations,
      sourceDocuments: fixtureSourceDocuments,
    });
    expect(report).toMatchObject({
      assessmentVersion: "assessment-v0.2",
      evidenceVersion: "evidence-v0.2",
      reportVersion: "assessment-report-v0.2",
      rulesVersion: "rules-v0.2",
      schoolDataVersion: "school-data-fixture-v0.1",
    });
    expect(report.createdAt).toBe(report.generatedAt);
    const verifiedEvidence = Object.values(report.evidenceIndex);
    expect(
      verifiedEvidence.every(
        (item) =>
          /^(CURRENT|LATEST_OFFICIAL_HISTORICAL|OUTDATED|UNKNOWN)$/.test(
            item.freshness
          ) &&
          /^(DIRECT|SUPPORTING|CONTEXTUAL)$/.test(item.relevance) &&
          /^(HIGH|MEDIUM|LOW)$/.test(item.strength) &&
          item.verified
      )
    ).toBe(true);
    expect(verifiedEvidence.some((item) => item.freshness === "CURRENT")).toBe(
      true
    );
    const conservativeReport = {
      ...report,
      schoolRecommendations: [
        {
          ...firstRecommendation(recommendations),
          tier: "CONSERVATIVE" as const,
        },
      ],
    };
    expect(
      serializeAssessmentReport(conservativeReport, "assessment-v0.2")
        .schoolRecommendations[0]?.tier
    ).toBe("CONSERVATIVE");
    const legacy = serializeAssessmentReport(
      conservativeReport,
      "assessment-v0.1"
    );
    expect(legacy.reportVersion).toBe("assessment-report-v0.1");
    expect(legacy.schoolRecommendations[0]).toMatchObject({
      canonicalTier: "CONSERVATIVE",
      tier: "SAFE",
    });
    expect(priorities[0]?.code).toBe("IMPROVE_ENGLISH");
    expect(new Set(priorities.map((item) => item.timeWindow))).toEqual(
      new Set(["DAYS_0_30", "DAYS_31_60", "DAYS_61_90"])
    );
    expect(
      priorities.every(
        (item) =>
          item.action.length > 0 &&
          item.why.length > 0 &&
          item.successSignal.length > 0
      )
    ).toBe(true);
    expect(validateAssessmentReport(report, ["prog-east-cs"])).toEqual({
      issues: [],
      valid: true,
    });
    const invalid = {
      ...report,
      schoolRecommendations: [
        {
          ...firstRecommendation(recommendations),
          evidenceIds: ["EV-NOT-FOUND"],
        },
      ],
    };
    expect(validateAssessmentReport(invalid).valid).toBe(false);
    expect(
      validateAssessmentReport(
        {
          ...report,
          schoolRecommendations: [
            { ...firstRecommendation(recommendations), programId: "missing" },
          ],
        },
        ["prog-east-cs"]
      ).valid
    ).toBe(false);
  });
});

async function matchingInput(
  cet6Score: number | undefined,
  riskPreference: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE" = "BALANCED",
  overrides: { dailyStudyHours?: number; rank?: number } = {}
) {
  const profile = parseStudentProfile({
    cet4Score: 540,
    cet6Score,
    cohortSize: 100,
    dailyStudyHours: overrides.dailyStudyHours ?? 4,
    grade: "SOPHOMORE",
    rank: overrides.rank ?? 5,
    researchExperiences: [
      { durationMonths: 12, output: "报告", role: "LEAD", title: "项目" },
    ],
    riskPreference,
    targetCities: ["上海"],
    targetMajors: ["计算机"],
    targetUniversities: [],
  });
  const result = await schools.findProgramCandidates({
    admissionYear: 2026,
    targetCities: ["上海"],
    targetMajors: ["计算机"],
  });
  return {
    admissionYear: 2026,
    assessmentResult: createAssessmentResult(
      profile,
      new Date("2026-01-01T00:00:00.000Z")
    ),
    candidates: result.candidates.filter(
      (candidate) => candidate.program.id === "prog-east-cs"
    ),
    evidence: fixtureEvidence.filter(
      (evidence) => evidence.programId === "prog-east-cs"
    ),
    profile,
    schoolDataVersion: "school-data-fixture-v0.1",
  };
}

function firstCandidate(input: Awaited<ReturnType<typeof matchingInput>>) {
  const [candidate] = input.candidates;
  if (!candidate) {
    throw new Error("Expected a candidate fixture");
  }
  return candidate;
}

function firstRecommendation(
  recommendations: ReturnType<typeof matchSchoolCandidates>
) {
  const [recommendation] = recommendations;
  if (!recommendation) {
    throw new Error("Expected a recommendation fixture");
  }
  return recommendation;
}
