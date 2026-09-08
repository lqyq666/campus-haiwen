import { postgraduateScoringConfig } from "./postgraduate-rules";
import { recommendationScoringConfig } from "./recommendation-rules";
import type { ScoreDimension } from "./types";

export type RuleCondition = {
  field: string;
  operator: "EVALUATE_BASELINE_BANDS";
};

export type RuleContribution = {
  dimension: ScoreDimension;
  weightPercent: number;
};

export type Rule = {
  conditions: RuleCondition[];
  contribution: RuleContribution;
  id: string;
  modelVersion: string;
};

export type RuleSet = {
  rules: Rule[];
  semanticsVersion: "rules-v0.1-compatible";
  status: "PROVISIONAL_PENDING_EXPERT_CALIBRATION";
  version: "rules-v0.2";
};

const sourceFields: Record<ScoreDimension, string[]> = {
  academicFoundation: ["rankPercentile", "gpa"],
  academics: ["rankPercentile", "gpa"],
  competition: ["competitionExperiences"],
  english: ["cet4Score", "cet6Score"],
  englishFoundation: ["cet4Score", "cet6Score"],
  experience: ["papers", "internships", "researchExperiences"],
  preparationTime: ["grade", "timeContext"],
  research: ["researchExperiences"],
  studyCapacity: ["dailyStudyHours"],
  targetClarity: ["targetCities", "targetUniversities", "targetMajors"],
};

function createCompatibilityRuleSet(
  modelVersion: string,
  weights: Partial<Record<ScoreDimension, number>>
): RuleSet {
  return {
    rules: Object.entries(weights).map(([dimension, weightPercent]) => ({
      conditions: sourceFields[dimension as ScoreDimension].map((field) => ({
        field,
        operator: "EVALUATE_BASELINE_BANDS" as const,
      })),
      contribution: {
        dimension: dimension as ScoreDimension,
        weightPercent: weightPercent ?? 0,
      },
      id: `rules-v0.2:${modelVersion}:${dimension}`,
      modelVersion,
    })),
    semanticsVersion: "rules-v0.1-compatible",
    status: "PROVISIONAL_PENDING_EXPERT_CALIBRATION",
    version: "rules-v0.2",
  };
}

export const recommendationRuleSet = createCompatibilityRuleSet(
  recommendationScoringConfig.version,
  recommendationScoringConfig.weights
);

export const postgraduateRuleSet = createCompatibilityRuleSet(
  postgraduateScoringConfig.version,
  postgraduateScoringConfig.weights
);
