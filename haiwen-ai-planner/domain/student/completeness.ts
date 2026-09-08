import type { StudentProfile } from "./schema";

export type ProfileCompleteness = {
  canScorePostgraduateExam: boolean;
  canScoreRecommendation: boolean;
  missingCriticalFields: string[];
  missingOptionalFields: string[];
  score: number;
};

export function evaluateProfileCompleteness(
  profile: StudentProfile
): ProfileCompleteness {
  const hasAcademic =
    profile.rankPercentile !== undefined || profile.gpa !== undefined;
  const hasEnglish =
    profile.cet6Score !== undefined || profile.cet4Score !== undefined;
  const critical = [
    ["grade", profile.grade !== undefined],
    ["academicRecord", hasAcademic],
    ["englishScore", hasEnglish],
  ] as const;
  const optional = [
    ["undergraduateUniversity", Boolean(profile.undergraduateUniversity)],
    ["undergraduateMajor", Boolean(profile.undergraduateMajor)],
    ["dailyStudyHours", profile.dailyStudyHours !== undefined],
    ["targetPreferences", hasTargetPreference(profile)],
    ["riskPreference", profile.riskPreference !== undefined],
    ["researchExperience", profile.researchExperiences.length > 0],
    ["competitionExperience", profile.competitionExperiences.length > 0],
    [
      "internshipOrPaper",
      profile.internships.length + profile.papers.length > 0,
    ],
  ] as const;
  const missingCriticalFields = critical
    .filter(([, present]) => !present)
    .map(([field]) => field);
  const missingOptionalFields = optional
    .filter(([, present]) => !present)
    .map(([field]) => field);
  const criticalScore = critical.filter(([, present]) => present).length * 20;
  const optionalScore = optional.filter(([, present]) => present).length * 5;

  return {
    canScorePostgraduateExam:
      profile.grade !== undefined &&
      (hasAcademic || hasEnglish) &&
      profile.dailyStudyHours !== undefined,
    canScoreRecommendation: profile.grade !== undefined && hasAcademic,
    missingCriticalFields,
    missingOptionalFields,
    score: Math.min(100, criticalScore + optionalScore),
  };
}

function hasTargetPreference(profile: StudentProfile) {
  return (
    profile.targetCities.length +
      profile.targetUniversities.length +
      profile.targetMajors.length >
    0
  );
}
