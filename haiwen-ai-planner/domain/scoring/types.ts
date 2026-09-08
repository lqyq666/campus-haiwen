export type ScoreDimension =
  | "academics"
  | "english"
  | "research"
  | "competition"
  | "experience"
  | "academicFoundation"
  | "englishFoundation"
  | "preparationTime"
  | "studyCapacity"
  | "targetClarity";

export type ScoreReason = {
  code: string;
  dimension: ScoreDimension;
  impact: number;
  message: string;
};

export type ScoreBand = "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH";

export type ScoreContribution = {
  dimension: ScoreDimension;
  message: string;
  points: number;
  rawDimensionScore: number;
  reasonCode: string;
  ruleId: string;
  sourceFields: string[];
  weight: number;
};

export type RiskFlagCode =
  | "RANKING_WEAK"
  | "RANKING_UNKNOWN"
  | "CET6_MISSING"
  | "ENGLISH_WEAK"
  | "RESEARCH_MISSING"
  | "COMPETITION_WEAK"
  | "PROFILE_INCOMPLETE"
  | "STUDY_TIME_LOW"
  | "TARGET_UNCLEAR"
  | "SUBJECT_FOUNDATION_UNKNOWN"
  | "TIME_WINDOW_SHORT";

export type RiskFlag = {
  code: RiskFlagCode;
  message: string;
};

export type ScoringResult<TDimensions> = {
  band: ScoreBand;
  bandStatus: "PROVISIONAL";
  confidence: number;
  contributions: ScoreContribution[];
  dimensions: TDimensions;
  missingData: string[];
  reasons: ScoreReason[];
  riskFlags: RiskFlag[];
  rulesSemanticsVersion: "rules-v0.1-compatible";
  rulesVersion: "rules-v0.2";
  total: number;
  version: string;
};

const provisionalBands = [
  { band: "HIGH", min: 80 },
  { band: "MEDIUM_HIGH", min: 65 },
  { band: "MEDIUM", min: 45 },
  { band: "LOW", min: 0 },
] as const;

const dimensionSources: Record<ScoreDimension, string[]> = {
  academicFoundation: ["rankPercentile", "gpa"],
  academics: ["rankPercentile", "gpa"],
  competition: ["competitionExperiences"],
  english: [
    "cet4Status",
    "cet4Score",
    "cet6Status",
    "cet6Score",
    "ieltsScore",
    "toeflScore",
  ],
  englishFoundation: [
    "cet4Status",
    "cet4Score",
    "cet6Status",
    "cet6Score",
    "ieltsScore",
    "toeflScore",
  ],
  experience: [
    "papers",
    "internships",
    "projects",
    "openSourceExperiences",
    "engineeringOutputs",
  ],
  preparationTime: ["grade", "timeContext"],
  research: ["researchExperiences"],
  studyCapacity: ["dailyStudyHours", "weeklyAvailableHours"],
  targetClarity: [
    "targetCities",
    "targetUniversities",
    "targetMajors",
    "targetProgramTypes",
  ],
};

export function explainScore<TDimensions extends object>(input: {
  dimensions: TDimensions;
  modelVersion: string;
  reasons: ScoreReason[];
  total: number;
  weights: Record<keyof TDimensions, number>;
}) {
  const entries = Object.entries(input.dimensions) as [
    keyof TDimensions & ScoreDimension,
    number,
  ][];
  const contributions = entries.map(([dimension, rawDimensionScore]) => {
    const reason = input.reasons.find((item) => item.dimension === dimension);
    return {
      dimension,
      message: reason?.message ?? "当前没有可用于该维度的有效输入。",
      points: clampScore(rawDimensionScore * (input.weights[dimension] / 100)),
      rawDimensionScore,
      reasonCode: reason?.code ?? `${dimension.toUpperCase()}_NO_INPUT`,
      ruleId: `${input.modelVersion}:${dimension}`,
      sourceFields: dimensionSources[dimension],
      weight: input.weights[dimension],
    } satisfies ScoreContribution;
  });
  const roundedBeforeLast = contributions
    .slice(0, -1)
    .reduce((sum, item) => sum + item.points, 0);
  const lastContribution = contributions.at(-1);
  if (lastContribution) {
    lastContribution.points = clampScore(input.total - roundedBeforeLast);
  }
  return {
    band: provisionalBands.find(({ min }) => input.total >= min)?.band ?? "LOW",
    bandStatus: "PROVISIONAL" as const,
    contributions,
    rulesSemanticsVersion: "rules-v0.1-compatible" as const,
    rulesVersion: "rules-v0.2" as const,
  };
}

export function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

export function last<T>(values: readonly T[]): T {
  const value = values.at(-1);
  if (value === undefined) {
    throw new Error("Scoring configuration must contain at least one band");
  }
  return value;
}

export function scoreByMinimumBand(
  bands: readonly { minScore: number; score: number }[],
  value: number
) {
  return (
    bands.find(({ minScore }) => value >= minScore)?.score ?? last(bands).score
  );
}
