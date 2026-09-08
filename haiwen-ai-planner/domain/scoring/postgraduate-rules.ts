export const postgraduateScoringConfig = {
  confidence: {
    academic: 15,
    base: 25,
    english: 15,
    studyHours: 15,
    targets: 10,
  },
  gradeTimeScores: {
    FRESHMAN: 100,
    GRADUATED: 30,
    JUNIOR: 72,
    SENIOR: 42,
    SOPHOMORE: 88,
  },
  studyHourBands: [
    { minHours: 6, score: 100 },
    { minHours: 4, score: 82 },
    { minHours: 2, score: 62 },
    { minHours: 1, score: 42 },
    { minHours: 0, score: 20 },
  ],
  targetClarityScores: { all: 100, none: 0, one: 40, two: 72 },
  version: "postgraduate-v0.1",
  weights: {
    academicFoundation: 25,
    englishFoundation: 20,
    preparationTime: 20,
    studyCapacity: 20,
    targetClarity: 15,
  },
} as const;
