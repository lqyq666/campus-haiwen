export const leadScoringConfig = {
  eventCaps: {
    ASSESSMENT_COMPLETED: 5,
    CONTACT_SUBMITTED: 10,
    REPORT_VIEWED: 5,
    REQUESTED_CONSULTATION: 15,
    RETURN_VISIT: 5,
  },
  eventPoints: {
    ASSESSMENT_COMPLETED: 5,
    CONTACT_SUBMITTED: 10,
    REPORT_VIEWED: 5,
    REQUESTED_CONSULTATION: 15,
    RETURN_VISIT: 5,
  },
  thresholds: { hot: 70, nurture: 20, qualified: 45 },
  urgency: {
    monthsRemaining: [
      { max: 3, score: 75 },
      { max: 6, score: 60 },
      { max: 12, score: 40 },
      { max: 18, score: 25 },
    ],
    requestedConsultation: 100,
    unknown: 10,
  },
  urgencyThresholds: { high: 60, normal: 25, urgent: 80 },
  version: "lead-score-v0.2",
} as const;
