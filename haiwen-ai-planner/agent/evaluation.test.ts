import { describe, expect, it } from "vitest";
import { InMemoryRetrievalRepository } from "@/domain/retrieval/in-memory-repository";
import {
  InMemoryEvidenceRepository,
  InMemorySchoolRepository,
} from "@/domain/school/in-memory-repository";
import {
  dualTrackSophomore,
  incompleteProfile,
  strongSophomore,
  weakJunior,
} from "@/domain/scoring/fixtures";
import { createHaiwenGraph } from "./graph";

const graph = createHaiwenGraph({
  evidenceRepository: new InMemoryEvidenceRepository(),
  retrievalRepository: new InMemoryRetrievalRepository(),
  schoolRepository: new InMemorySchoolRepository(),
});

describe("M4B end-to-end evaluation fixtures", () => {
  it.each([
    [
      "strong recommendation student",
      {
        ...strongSophomore,
        targetCities: ["上海"],
        targetMajors: ["计算机"],
        targetUniversities: [],
      },
    ],
    [
      "weak postgraduate student",
      {
        ...weakJunior,
        targetCities: ["上海"],
        targetMajors: ["计算机"],
        targetUniversities: [],
      },
    ],
    [
      "dual-track student",
      {
        ...dualTrackSophomore,
        targetCities: ["上海"],
        targetMajors: ["电子信息"],
        targetUniversities: [],
      },
    ],
    [
      "missing English student",
      {
        ...strongSophomore,
        cet6Score: undefined,
        targetCities: ["上海"],
        targetMajors: ["计算机"],
        targetUniversities: [],
      },
    ],
    ["incomplete-profile student", incompleteProfile],
  ])("keeps facts, citations, and deterministic report for %s", async (_name, studentProfile) => {
    const result = await graph.invoke({
      admissionYear: 2026,
      errors: [],
      evidence: [],
      evidencePack: null,
      generatedNarrative: null,
      leadScore: null,
      modelMetadata: null,
      pathDecision: null,
      recommendations: [],
      report: null,
      retrievalMode: null,
      retrievalQuery: null,
      retrievedChunks: [],
      roadmap: [],
      schoolCandidates: [],
      schoolMatches: [],
      scores: null,
      studentProfile,
      validationResult: null,
      warnings: [],
    });
    expect(result.validationResult?.valid).toBe(true);
    expect(result.report?.reportVersion).toBe("assessment-report-v0.2");
    expect(
      result.report?.schoolRecommendations.every((item) =>
        item.evidenceIds.every((id) => result.report?.evidenceIndex[id])
      )
    ).toBe(true);
    expect(result.warnings).toContain("AI_REPORT_UNAVAILABLE");
  });
});
