import {
  calculatePostgraduateExamScore,
  type PostgraduateExamScore,
} from "../scoring/postgraduate";
import {
  calculateRecommendationScore,
  type RecommendationScore,
} from "../scoring/recommendation";
import {
  evaluateProfileCompleteness,
  type ProfileCompleteness,
} from "../student/completeness";
import type { StudentProfile } from "../student/schema";
import { chooseStudyPath, type PathDecision } from "./path-router";

export const assessmentScoringVersion = {
  pathRouter: "path-router-v0.1",
  postgraduateExam: "postgraduate-v0.1",
  recommendation: "recommendation-v0.1",
} as const;

export type AssessmentResult = {
  generatedAt: string;
  pathDecision: PathDecision;
  postgraduateExamScore: PostgraduateExamScore;
  profileCompleteness: ProfileCompleteness;
  recommendationScore: RecommendationScore;
  scoringVersion: typeof assessmentScoringVersion;
};

export function createAssessmentResult(
  profile: StudentProfile,
  generatedAt = new Date()
): AssessmentResult {
  const profileCompleteness = evaluateProfileCompleteness(profile);
  const recommendationScore = calculateRecommendationScore(profile);
  const postgraduateExamScore = calculatePostgraduateExamScore(profile);
  const pathDecision = chooseStudyPath({
    completeness: profileCompleteness,
    postgraduateExamScore,
    profile,
    recommendationScore,
  });

  return {
    generatedAt: generatedAt.toISOString(),
    pathDecision,
    postgraduateExamScore,
    profileCompleteness,
    recommendationScore,
    scoringVersion: assessmentScoringVersion,
  };
}
