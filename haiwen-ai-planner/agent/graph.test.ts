import { describe, expect, it } from "vitest";
import { InMemoryRetrievalRepository } from "@/domain/retrieval/in-memory-repository";
import {
  InMemoryEvidenceRepository,
  InMemorySchoolRepository,
} from "@/domain/school/in-memory-repository";
import { strongSophomore } from "@/domain/scoring/fixtures";
import { createHaiwenGraph } from "./graph";

describe("haiwenGraph", () => {
  it("runs deterministic school matching and report contract nodes", async () => {
    const haiwenGraph = createHaiwenGraph({
      evidenceRepository: new InMemoryEvidenceRepository(),
      retrievalRepository: new InMemoryRetrievalRepository(),
      schoolRepository: new InMemorySchoolRepository(),
    });
    const input = {
      admissionYear: 2026,
      errors: [],
      evidence: [],
      leadScore: null,
      pathDecision: null,
      recommendations: [],
      report: null,
      roadmap: [],
      schoolCandidates: [],
      schoolMatches: [],
      scores: null,
      studentProfile: {
        ...strongSophomore,
        targetCities: ["上海"],
        targetMajors: ["计算机"],
        targetUniversities: [],
      },
      validationResult: null,
    };

    const result = await haiwenGraph.invoke(input);
    expect(result.validationResult?.valid).toBe(true);
    expect(result.scores?.recommendation.total).toBeGreaterThan(0);
    expect(result.pathDecision?.path).not.toBe("INSUFFICIENT_DATA");
    expect(result.schoolCandidates).toHaveLength(1);
    expect(result.schoolCandidates[0]?.program.id).toBe("prog-east-cs");
    expect(result.evidence.some((item) => item.id === "EV-000002")).toBe(true);
    expect(result.schoolMatches).toHaveLength(1);
    expect(result.report?.reportVersion).toBe("assessment-report-v0.2");
    expect(result.errors).toEqual([]);
  });

  it("requires an explicit admission year", async () => {
    const haiwenGraph = createHaiwenGraph({
      evidenceRepository: new InMemoryEvidenceRepository(),
      retrievalRepository: new InMemoryRetrievalRepository(),
      schoolRepository: new InMemorySchoolRepository(),
    });
    const result = await haiwenGraph.invoke({
      admissionYear: null,
      errors: [],
      evidence: [],
      leadScore: null,
      pathDecision: null,
      recommendations: [],
      report: null,
      roadmap: [],
      schoolCandidates: [],
      schoolMatches: [],
      scores: null,
      studentProfile: strongSophomore,
      validationResult: null,
    });
    expect(result.errors.map((error) => error.code)).toContain(
      "ADMISSION_YEAR_REQUIRED"
    );
  });
});
