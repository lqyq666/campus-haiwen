import type {
  AssessmentReport,
  LegacySchoolMatchTier,
  SchoolMatchResult,
  SchoolMatchTier,
} from "./models";

export type AssessmentContractVersion = "assessment-v0.1" | "assessment-v0.2";

export type LegacyAssessmentReport = Omit<
  AssessmentReport,
  "reportVersion" | "schoolRecommendations"
> & {
  reportVersion: "assessment-report-v0.1";
  schoolRecommendations: Array<
    Omit<SchoolMatchResult, "tier"> & {
      canonicalTier: SchoolMatchTier;
      tier: LegacySchoolMatchTier;
    }
  >;
};

export function serializeAssessmentReport(
  report: AssessmentReport,
  version: "assessment-v0.1"
): LegacyAssessmentReport;
export function serializeAssessmentReport(
  report: AssessmentReport,
  version: "assessment-v0.2"
): AssessmentReport;
export function serializeAssessmentReport(
  report: AssessmentReport,
  version: AssessmentContractVersion
): AssessmentReport | LegacyAssessmentReport;
export function serializeAssessmentReport(
  report: AssessmentReport,
  version: AssessmentContractVersion
): AssessmentReport | LegacyAssessmentReport {
  if (version === "assessment-v0.2") {
    return report;
  }
  return {
    ...report,
    reportVersion: "assessment-report-v0.1",
    schoolRecommendations: report.schoolRecommendations.map((item) => ({
      ...item,
      canonicalTier: item.tier,
      tier: item.tier === "CONSERVATIVE" ? "SAFE" : item.tier,
    })),
  };
}
