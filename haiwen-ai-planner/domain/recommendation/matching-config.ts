export const schoolMatchingConfig = {
  confidence: {
    evidenceCoverage: 20,
    high: 80,
    medium: 60,
    policyCoverage: 20,
    profileCompleteness: 60,
  },
  maxRecommendations: 9,
  maxRecommendationsPerTier: 3,
  riskPreference: {
    AGGRESSIVE: { conservative: -5, match: -5 },
    BALANCED: { conservative: 0, match: 0 },
    CONSERVATIVE: { conservative: 5, match: 5 },
  },
  tierThresholds: {
    conservative: 78,
    match: 60,
  },
  version: "school-matching-v0.1",
  weights: {
    evidenceQuality: 15,
    policyFit: 25,
    profileStrength: 45,
    targetAlignment: 15,
  },
} as const;
