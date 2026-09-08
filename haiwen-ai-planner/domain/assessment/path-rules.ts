export const pathRouterConfig = {
  earlyGrades: ["FRESHMAN", "SOPHOMORE"],
  matureGrades: ["SENIOR", "GRADUATED"],
  thresholds: {
    earlyRecommendation: 85,
    earlyViableTrack: 45,
    examReady: 55,
    matureRecommendation: 78,
    recommendation: 72,
    recommendationViable: 55,
  },
  version: "path-router-v0.1",
} as const;
