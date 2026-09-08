import type { StudyPath } from "@/domain/assessment/path-router";
import type { SchoolMatchTier } from "@/domain/recommendation/models";
import type { StudentProfile } from "@/domain/student/schema";

export type CalibrationCaseV02 = {
  caseCode: string;
  createdAt: string;
  id: string;
  sourceType: "SYNTHETIC_TEST" | "EXPERT_REVIEW" | "REAL_ANONYMIZED";
  status: "DRAFT" | "READY" | "IN_REVIEW" | "COMPLETE";
  studentProfileSnapshot: StudentProfile;
};

export type ExpertReviewer = {
  createdAt: string;
  experienceLevel: string;
  id: string;
  reviewerCode: string;
  roleType: "PLANNING_EXPERT" | "CONSULTANT" | "SALES_OR_OPERATIONS";
};

export type ExpertJudgment = {
  decisionChangeConditions: string;
  examScoreRange?: ScoreRange;
  missingInformation: string[];
  notes?: string;
  path: StudyPath;
  recommendationScoreRange?: ScoreRange;
  schoolTiers: Array<{
    programId: string;
    tier: SchoolMatchTier | "EXCLUDE" | "UNKNOWN";
  }>;
  topActions: string[];
  topRisks: string[];
};

export type ExpertReview = {
  caseId: string;
  id: string;
  judgment: ExpertJudgment;
  lockedAt: string;
  revealedAt?: string;
  reviewerId: string;
  submittedAt: string;
};

export type SystemPredictionSnapshot = {
  actionPriorities: string[];
  caseId: string;
  createdAt: string;
  examScore: number;
  id: string;
  missingInformation?: string[];
  modelVersions: Record<string, string>;
  path: StudyPath;
  recommendationScore: number;
  risks: string[];
  schoolTiers: Array<{ programId: string; tier: SchoolMatchTier }>;
};

export type CalibrationDisagreementType =
  | "PATH"
  | "RECOMMENDATION_SCORE"
  | "EXAM_SCORE"
  | "RISK"
  | "SCHOOL_TIER"
  | "ACTION"
  | "EVIDENCE"
  | "MISSING_DATA";

export type CalibrationDisagreement = {
  expertReason?: string;
  expertValue: unknown;
  id: string;
  reviewId: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  systemValue: unknown;
  type: CalibrationDisagreementType;
};

export type CalibrationMetricsV02 = {
  actionRecall: number;
  caseCount: number;
  examScoreRangeAgreement: number;
  interExpertAgreement: number;
  pathAgreement: number;
  recommendationScoreRangeAgreement: number;
  reviewerCount: number;
  riskPrecision: number;
  riskRecall: number;
  schoolTierAgreement: number;
  topDisagreementTypes: Array<{
    count: number;
    type: CalibrationDisagreementType;
  }>;
  version: "calibration-v0.2";
};

export type CalibrationRun = {
  completedAt?: string;
  id: string;
  metrics?: CalibrationMetricsV02;
  startedAt: string;
  status: "RUNNING" | "COMPLETE" | "FAILED";
  version: "calibration-v0.2";
};

export type RuleCandidate = {
  createdAt: string;
  disagreementIds: string[];
  id: string;
  proposal: Record<string, unknown>;
  status: "PROPOSED" | "REVIEWED" | "APPROVED" | "REJECTED";
  updatedAt: string;
};

export function createRuleCandidate(input: {
  disagreementIds: string[];
  id?: string;
  now?: Date;
  proposal: Record<string, unknown>;
}): RuleCandidate {
  if (!input.disagreementIds.length || !Object.keys(input.proposal).length) {
    throw new Error("INVALID_RULE_CANDIDATE");
  }
  const timestamp = (input.now ?? new Date()).toISOString();
  return {
    createdAt: timestamp,
    disagreementIds: [...new Set(input.disagreementIds)],
    id: input.id ?? crypto.randomUUID(),
    proposal: structuredClone(input.proposal),
    status: "PROPOSED",
    updatedAt: timestamp,
  };
}

type ScoreRange = { max: number; min: number };

export interface CalibrationRepository {
  findReview: (
    caseId: string,
    reviewerId: string
  ) => Promise<ExpertReview | undefined>;
  findReviewerByCode: (code: string) => Promise<ExpertReviewer | undefined>;
  getCase: (id: string) => Promise<CalibrationCaseV02 | undefined>;
  getPrediction: (
    caseId: string
  ) => Promise<SystemPredictionSnapshot | undefined>;
  getReview: (id: string) => Promise<ExpertReview | undefined>;
  listDisagreements: (reviewId: string) => Promise<CalibrationDisagreement[]>;
  saveDisagreements: (
    disagreements: CalibrationDisagreement[]
  ) => Promise<void>;
  saveReview: (review: ExpertReview) => Promise<void>;
  saveReviewer: (reviewer: ExpertReviewer) => Promise<void>;
  setReviewRevealedAt: (reviewId: string, revealedAt: string) => Promise<void>;
}

export class CalibrationWorkbench {
  private readonly now: () => Date;
  private readonly repository: CalibrationRepository;

  constructor(
    repository: CalibrationRepository,
    now: () => Date = () => new Date()
  ) {
    this.repository = repository;
    this.now = now;
  }

  async openCase(
    caseId: string,
    reviewerInput: Pick<
      ExpertReviewer,
      "experienceLevel" | "reviewerCode" | "roleType"
    >
  ) {
    const calibrationCase = await this.repository.getCase(caseId);
    if (!calibrationCase) {
      throw new Error("CALIBRATION_CASE_NOT_FOUND");
    }
    const reviewer = await this.ensureReviewer(reviewerInput);
    const review = await this.repository.findReview(caseId, reviewer.id);
    return {
      case: calibrationCase,
      reviewStatus: review ? ("SUBMITTED" as const) : ("NOT_STARTED" as const),
    };
  }

  async submitReview(input: {
    caseId: string;
    judgment: ExpertJudgment;
    reviewerCode: string;
  }) {
    const reviewer = await this.repository.findReviewerByCode(
      input.reviewerCode
    );
    if (!reviewer) {
      throw new Error("EXPERT_REVIEWER_NOT_REGISTERED");
    }
    if (await this.repository.findReview(input.caseId, reviewer.id)) {
      throw new Error("EXPERT_REVIEW_LOCKED");
    }
    validateJudgment(input.judgment);
    const timestamp = this.now().toISOString();
    const review: ExpertReview = {
      caseId: input.caseId,
      id: crypto.randomUUID(),
      judgment: structuredClone(input.judgment),
      lockedAt: timestamp,
      reviewerId: reviewer.id,
      submittedAt: timestamp,
    };
    await this.repository.saveReview(review);
    const prediction = await this.repository.getPrediction(input.caseId);
    if (prediction) {
      await this.repository.saveDisagreements(
        comparePrediction(review, prediction)
      );
    }
    return review;
  }

  async revealReview(reviewId: string, reviewerCode: string) {
    const [reviewer, review] = await Promise.all([
      this.repository.findReviewerByCode(reviewerCode),
      this.repository.getReview(reviewId),
    ]);
    if (!(reviewer && review && reviewer.id === review.reviewerId)) {
      throw new Error("CALIBRATION_REVIEW_NOT_FOUND");
    }
    const systemPrediction = await this.repository.getPrediction(review.caseId);
    if (!systemPrediction) {
      throw new Error("SYSTEM_PREDICTION_NOT_FOUND");
    }
    const revealedAt = review.revealedAt ?? this.now().toISOString();
    if (!review.revealedAt) {
      await this.repository.setReviewRevealedAt(review.id, revealedAt);
    }
    return {
      disagreements: await this.repository.listDisagreements(review.id),
      expertReview: { ...review, revealedAt },
      systemPrediction,
    };
  }

  private async ensureReviewer(
    input: Pick<ExpertReviewer, "experienceLevel" | "reviewerCode" | "roleType">
  ) {
    const existing = await this.repository.findReviewerByCode(
      input.reviewerCode
    );
    if (existing) {
      return existing;
    }
    const reviewer: ExpertReviewer = {
      ...input,
      createdAt: this.now().toISOString(),
      id: crypto.randomUUID(),
    };
    await this.repository.saveReviewer(reviewer);
    return reviewer;
  }
}

export class InMemoryCalibrationRepository implements CalibrationRepository {
  private readonly cases = new Map<string, CalibrationCaseV02>();
  private readonly disagreements = new Map<string, CalibrationDisagreement[]>();
  private readonly predictions = new Map<string, SystemPredictionSnapshot>();
  private readonly reviewers = new Map<string, ExpertReviewer>();
  private readonly reviews = new Map<string, ExpertReview>();

  constructor(
    seed: {
      cases?: CalibrationCaseV02[];
      predictions?: SystemPredictionSnapshot[];
    } = {}
  ) {
    for (const item of seed.cases ?? []) {
      this.cases.set(item.id, item);
    }
    for (const item of seed.predictions ?? []) {
      this.predictions.set(item.caseId, item);
    }
  }

  findReview(caseId: string, reviewerId: string) {
    return Promise.resolve(
      [...this.reviews.values()].find(
        (item) => item.caseId === caseId && item.reviewerId === reviewerId
      )
    );
  }
  findReviewerByCode(code: string) {
    return Promise.resolve(
      [...this.reviewers.values()].find((item) => item.reviewerCode === code)
    );
  }
  getCase(id: string) {
    return Promise.resolve(this.cases.get(id));
  }
  getPrediction(caseId: string) {
    return Promise.resolve(this.predictions.get(caseId));
  }
  getReview(id: string) {
    return Promise.resolve(this.reviews.get(id));
  }
  listDisagreements(reviewId: string) {
    return Promise.resolve(this.disagreements.get(reviewId) ?? []);
  }
  saveDisagreements(items: CalibrationDisagreement[]) {
    if (items[0]) {
      this.disagreements.set(items[0].reviewId, structuredClone(items));
    }
    return Promise.resolve();
  }
  saveReview(review: ExpertReview) {
    this.reviews.set(review.id, structuredClone(review));
    return Promise.resolve();
  }
  saveReviewer(reviewer: ExpertReviewer) {
    this.reviewers.set(reviewer.id, structuredClone(reviewer));
    return Promise.resolve();
  }
  setReviewRevealedAt(reviewId: string, revealedAt: string) {
    const review = this.reviews.get(reviewId);
    if (review) {
      this.reviews.set(reviewId, { ...review, revealedAt });
    }
    return Promise.resolve();
  }
}

function validateJudgment(judgment: ExpertJudgment) {
  if (!judgment.decisionChangeConditions.trim()) {
    throw new Error("DECISION_CHANGE_CONDITIONS_REQUIRED");
  }
  for (const range of [
    judgment.recommendationScoreRange,
    judgment.examScoreRange,
  ]) {
    if (
      range &&
      (range.min < 0 ||
        range.max > 100 ||
        range.min > range.max ||
        !Number.isFinite(range.min) ||
        !Number.isFinite(range.max))
    ) {
      throw new Error("INVALID_EXPERT_SCORE_RANGE");
    }
  }
}

function comparePrediction(
  review: ExpertReview,
  prediction: SystemPredictionSnapshot
): CalibrationDisagreement[] {
  const items: CalibrationDisagreement[] = [];
  const push = (
    type: CalibrationDisagreementType,
    systemValue: unknown,
    expertValue: unknown,
    severity: CalibrationDisagreement["severity"] = "MEDIUM"
  ) => {
    items.push({
      expertReason: review.judgment.notes,
      expertValue,
      id: crypto.randomUUID(),
      reviewId: review.id,
      severity,
      systemValue,
      type,
    });
  };
  if (prediction.path !== review.judgment.path) {
    push("PATH", prediction.path, review.judgment.path, "HIGH");
  }
  if (
    !inRange(
      prediction.recommendationScore,
      review.judgment.recommendationScoreRange
    )
  ) {
    push(
      "RECOMMENDATION_SCORE",
      prediction.recommendationScore,
      review.judgment.recommendationScoreRange
    );
  }
  if (!inRange(prediction.examScore, review.judgment.examScoreRange)) {
    push("EXAM_SCORE", prediction.examScore, review.judgment.examScoreRange);
  }
  if (!sameSet(prediction.risks, review.judgment.topRisks)) {
    push("RISK", prediction.risks, review.judgment.topRisks);
  }
  if (!sameSet(prediction.actionPriorities, review.judgment.topActions)) {
    push("ACTION", prediction.actionPriorities, review.judgment.topActions);
  }
  if (!sameSchoolTiers(prediction.schoolTiers, review.judgment.schoolTiers)) {
    push("SCHOOL_TIER", prediction.schoolTiers, review.judgment.schoolTiers);
  }
  if (
    !sameSet(
      prediction.missingInformation ?? [],
      review.judgment.missingInformation
    )
  ) {
    push(
      "MISSING_DATA",
      prediction.missingInformation ?? [],
      review.judgment.missingInformation
    );
  }
  return items;
}

function inRange(value: number, range: ScoreRange | undefined) {
  return !range || (value >= range.min && value <= range.max);
}

function sameSet(left: string[], right: string[]) {
  return (
    [...new Set(left)].sort().join("\u0000") ===
    [...new Set(right)].sort().join("\u0000")
  );
}

function sameSchoolTiers(
  system: SystemPredictionSnapshot["schoolTiers"],
  expert: ExpertJudgment["schoolTiers"]
) {
  const serialize = (items: Array<{ programId: string; tier: string }>) =>
    items
      .map((item) => `${item.programId}:${item.tier}`)
      .sort((left, right) => left.localeCompare(right))
      .join("\u0000");
  return serialize(system) === serialize(expert);
}

export function calculateInterExpertAgreement(reviews: ExpertReview[]) {
  const byCase = new Map<string, ExpertReview[]>();
  for (const review of reviews) {
    byCase.set(review.caseId, [...(byCase.get(review.caseId) ?? []), review]);
  }
  let agreeingPairs = 0;
  let pairs = 0;
  for (const caseReviews of byCase.values()) {
    for (let left = 0; left < caseReviews.length; left += 1) {
      for (let right = left + 1; right < caseReviews.length; right += 1) {
        pairs += 1;
        if (
          caseReviews[left]?.judgment.path === caseReviews[right]?.judgment.path
        ) {
          agreeingPairs += 1;
        }
      }
    }
  }
  return pairs ? agreeingPairs / pairs : 0;
}

export function calculateCalibrationMetrics(input: {
  disagreements: CalibrationDisagreement[];
  predictions: SystemPredictionSnapshot[];
  reviews: ExpertReview[];
}): CalibrationMetricsV02 {
  const predictions = new Map(
    input.predictions.map((prediction) => [prediction.caseId, prediction])
  );
  const comparable = input.reviews.flatMap((review) => {
    const prediction = predictions.get(review.caseId);
    return prediction ? [{ prediction, review }] : [];
  });
  const rate = (values: boolean[]) =>
    values.length ? values.filter(Boolean).length / values.length : 0;
  const recommendationRanges = comparable.flatMap(({ prediction, review }) =>
    review.judgment.recommendationScoreRange
      ? [
          inRange(
            prediction.recommendationScore,
            review.judgment.recommendationScoreRange
          ),
        ]
      : []
  );
  const examRanges = comparable.flatMap(({ prediction, review }) =>
    review.judgment.examScoreRange
      ? [inRange(prediction.examScore, review.judgment.examScoreRange)]
      : []
  );
  const riskPairs = comparable.map(({ prediction, review }) =>
    precisionRecall(prediction.risks, review.judgment.topRisks)
  );
  const actionPairs = comparable.map(({ prediction, review }) =>
    precisionRecall(prediction.actionPriorities, review.judgment.topActions)
  );
  const tierAgreement = comparable.flatMap(({ prediction, review }) => {
    const system = new Map(
      prediction.schoolTiers.map((item) => [item.programId, item.tier])
    );
    return review.judgment.schoolTiers.map(
      (item) => system.get(item.programId) === item.tier
    );
  });
  const disagreementCounts = new Map<CalibrationDisagreementType, number>();
  for (const item of input.disagreements) {
    disagreementCounts.set(
      item.type,
      (disagreementCounts.get(item.type) ?? 0) + 1
    );
  }
  const average = (values: number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  return {
    actionRecall: average(actionPairs.map((item) => item.recall)),
    caseCount: new Set(input.reviews.map((review) => review.caseId)).size,
    examScoreRangeAgreement: rate(examRanges),
    interExpertAgreement: calculateInterExpertAgreement(input.reviews),
    pathAgreement: rate(
      comparable.map(
        ({ prediction, review }) => prediction.path === review.judgment.path
      )
    ),
    recommendationScoreRangeAgreement: rate(recommendationRanges),
    reviewerCount: new Set(input.reviews.map((review) => review.reviewerId))
      .size,
    riskPrecision: average(riskPairs.map((item) => item.precision)),
    riskRecall: average(riskPairs.map((item) => item.recall)),
    schoolTierAgreement: rate(tierAgreement),
    topDisagreementTypes: [...disagreementCounts.entries()]
      .map(([type, count]) => ({ count, type }))
      .sort(
        (left, right) =>
          right.count - left.count || left.type.localeCompare(right.type)
      ),
    version: "calibration-v0.2",
  };
}

function precisionRecall(system: string[], expert: string[]) {
  const systemSet = new Set(system);
  const expertSet = new Set(expert);
  const intersection = [...systemSet].filter((item) =>
    expertSet.has(item)
  ).length;
  return {
    precision: systemSet.size
      ? intersection / systemSet.size
      : expertSet.size
        ? 0
        : 1,
    recall: expertSet.size
      ? intersection / expertSet.size
      : systemSet.size
        ? 0
        : 1,
  };
}
