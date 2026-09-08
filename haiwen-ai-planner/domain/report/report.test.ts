import { expect, it } from "vitest";
import { createAssessmentResult } from "@/domain/assessment/result";
import { matchSchoolCandidates } from "@/domain/recommendation/matching";
import { createAssessmentReport } from "@/domain/recommendation/report";
import { fixtureSourceDocuments } from "@/domain/school/fixtures";
import { InMemorySchoolRepository } from "@/domain/school/in-memory-repository";
import { parseStudentProfile } from "@/domain/student/schema";
import { createFakeReportGenerator } from "@/lib/ai/report-generator";
import { validateGeneratedNarrative } from "./validation";

it("accepts allowlisted fake narratives and rejects hallucinated citations/programs", async () => {
  const profile = parseStudentProfile({
    cet6Score: 560,
    cohortSize: 100,
    dailyStudyHours: 4,
    grade: "SOPHOMORE",
    rank: 5,
    targetCities: ["上海"],
    targetMajors: ["计算机"],
  });
  const { candidates } =
    await new InMemorySchoolRepository().findProgramCandidates({
      admissionYear: 2026,
      targetCities: ["上海"],
      targetMajors: ["计算机"],
    });
  const assessmentResult = createAssessmentResult(profile);
  const report = createAssessmentReport({
    actionPriorities: [],
    admissionYear: 2026,
    assessmentResult,
    evidence: candidates.flatMap((item) => item.evidence),
    profile,
    schoolRecommendations: matchSchoolCandidates({
      admissionYear: 2026,
      assessmentResult,
      candidates,
      evidence: candidates.flatMap((item) => item.evidence),
      profile,
    }),
    sourceDocuments: fixtureSourceDocuments,
  });
  const pack = {
    allowedEvidenceIds: Object.keys(report.evidenceIndex),
    coverage: { retrievedChunks: 1, warnings: [] },
    evidences: Object.values(report.evidenceIndex),
    facts: [],
    programId: candidates[0]?.program.id ?? "",
    sourceDocuments: [],
  };
  const narrative = await createFakeReportGenerator().generate({
    evidencePack: pack,
    report,
  });
  expect(
    validateGeneratedNarrative(narrative, report, pack.allowedEvidenceIds).valid
  ).toBe(true);
  const [firstExplanation] = narrative.schoolExplanations;
  if (!firstExplanation) {
    throw new Error("Expected narrative explanation");
  }
  expect(
    validateGeneratedNarrative(
      {
        ...narrative,
        schoolExplanations: [
          {
            ...firstExplanation,
            evidenceIds: ["EV-DOES-NOT-EXIST"],
            programId: "unknown",
          },
        ],
      },
      report,
      pack.allowedEvidenceIds
    ).valid
  ).toBe(false);
});
