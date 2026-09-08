import type { AssessmentReport } from "@/domain/recommendation/models";
import type { GeneratedReportNarrative, NarrativeValidation } from "./models";

export function validateGeneratedNarrative(
  narrative: GeneratedReportNarrative,
  report: AssessmentReport,
  allowedEvidenceIds: readonly string[]
): NarrativeValidation {
  const programs = new Set(
    report.schoolRecommendations.map((item) => item.programId)
  );
  const evidence = new Set(allowedEvidenceIds);
  const issues: string[] = [];
  for (const item of narrative.schoolExplanations) {
    if (!programs.has(item.programId)) {
      issues.push(`unknown programId ${item.programId}`);
    }
    for (const id of item.evidenceIds) {
      if (!evidence.has(id)) {
        issues.push(`unknown evidenceId ${id}`);
      }
    }
  }
  if (
    !(
      narrative.roadmap.days0To30.length &&
      narrative.roadmap.days31To60.length &&
      narrative.roadmap.days61To90.length
    )
  ) {
    issues.push("roadmap sections are required");
  }
  return { issues: [...new Set(issues)], valid: issues.length === 0 };
}
