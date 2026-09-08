import type { PostgraduateExamScore } from "../scoring/postgraduate";
import type { RecommendationScore } from "../scoring/recommendation";
import { clampScore, type RiskFlag } from "../scoring/types";
import type { ProfileCompleteness } from "../student/completeness";
import type { StudentProfile } from "../student/schema";
import { pathRouterConfig as config } from "./path-rules";

export type StudyPath =
  | "RECOMMENDATION"
  | "POSTGRAD_EXAM"
  | "DUAL_TRACK"
  | "INSUFFICIENT_DATA";

export type PathReason = {
  code: string;
  message: string;
};

export type PathDecision = {
  alternativePaths: StudyPath[];
  confidence: number;
  decisionReasonCodes: string[];
  missingData: string[];
  missingCriticalData: string[];
  path: StudyPath;
  positiveFactors: string[];
  reasons: PathReason[];
  riskFactors: string[];
  riskFlags: RiskFlag[];
  rulesVersion: "rules-v0.2";
  selectedPath: StudyPath;
  triggeredRules: string[];
  version: string;
};

export type ChooseStudyPathInput = {
  completeness: ProfileCompleteness;
  postgraduateExamScore: PostgraduateExamScore;
  profile: StudentProfile;
  recommendationScore: RecommendationScore;
};

export function chooseStudyPath(input: ChooseStudyPathInput): PathDecision {
  const { completeness, postgraduateExamScore, profile, recommendationScore } =
    input;
  const shared = {
    missingData: [...completeness.missingCriticalFields],
    riskFlags: uniqueRiskFlags([
      ...recommendationScore.riskFlags,
      ...postgraduateExamScore.riskFlags,
    ]),
    version: config.version,
  };

  if (completeness.missingCriticalFields.length > 0 || !profile.grade) {
    return withDecisionTrace({
      ...shared,
      confidence: clampScore(completeness.score),
      path: "INSUFFICIENT_DATA",
      reasons: [
        {
          code: "CRITICAL_PROFILE_DATA_MISSING",
          message: `需要补充：${completeness.missingCriticalFields.join(", ")}`,
        },
      ],
    });
  }

  const recommendation = recommendationScore.total;
  const exam = postgraduateExamScore.total;
  const earlyGrade = config.earlyGrades.some(
    (grade) => grade === profile.grade
  );
  const matureGrade = config.matureGrades.some(
    (grade) => grade === profile.grade
  );

  if (earlyGrade) {
    if (recommendation >= config.thresholds.earlyRecommendation) {
      return decision(
        "RECOMMENDATION",
        "EARLY_RECOMMENDATION_STRONG",
        "低年级且当前保研竞争力很强",
        input,
        shared
      );
    }
    if (
      recommendation >= config.thresholds.earlyViableTrack ||
      exam >= config.thresholds.earlyViableTrack
    ) {
      return decision(
        "DUAL_TRACK",
        "EARLY_IMPROVEMENT_WINDOW",
        "低年级仍有提升窗口，建议保研与考研双轨准备",
        input,
        shared
      );
    }
    return decision(
      "POSTGRAD_EXAM",
      "EARLY_RECOMMENDATION_WEAK",
      "当前保研基础较弱，先以考研能力建设为主",
      input,
      shared
    );
  }

  if (matureGrade) {
    if (
      recommendation >= config.thresholds.matureRecommendation &&
      profile.rankPercentile !== undefined &&
      profile.rankPercentile <= 15
    ) {
      return decision(
        "RECOMMENDATION",
        "MATURE_RECOMMENDATION_READY",
        "时间窗口较短，但当前排名与保研竞争力仍较强",
        input,
        shared
      );
    }
    return decision(
      "POSTGRAD_EXAM",
      "MATURE_TIME_WINDOW",
      "当前年级提升保研材料的时间窗口有限，建议聚焦考研准备",
      input,
      shared
    );
  }

  if (
    recommendation >= config.thresholds.recommendation &&
    recommendation >= exam
  ) {
    return decision(
      "RECOMMENDATION",
      "RECOMMENDATION_ADVANTAGE",
      "保研竞争力达到基线且优于当前考研准备度",
      input,
      shared
    );
  }
  if (
    recommendation >= config.thresholds.recommendationViable &&
    exam >= config.thresholds.examReady
  ) {
    return decision(
      "DUAL_TRACK",
      "BOTH_TRACKS_VIABLE",
      "保研竞争力和考研准备度均具备继续投入价值",
      input,
      shared
    );
  }
  return decision(
    "POSTGRAD_EXAM",
    "EXAM_TRACK_ADVANTAGE",
    "当前保研竞争力不足，考研路径更可控",
    input,
    shared
  );
}

function decision(
  path: Exclude<StudyPath, "INSUFFICIENT_DATA">,
  code: string,
  message: string,
  input: ChooseStudyPathInput,
  shared: Pick<PathDecision, "missingData" | "riskFlags" | "version">
): PathDecision {
  return withDecisionTrace({
    ...shared,
    confidence: clampScore(
      Math.min(
        input.completeness.score,
        (input.recommendationScore.confidence +
          input.postgraduateExamScore.confidence) /
          2
      )
    ),
    path,
    reasons: [{ code, message }],
  });
}

type LegacyPathDecision = Omit<
  PathDecision,
  | "alternativePaths"
  | "decisionReasonCodes"
  | "missingCriticalData"
  | "positiveFactors"
  | "riskFactors"
  | "rulesVersion"
  | "selectedPath"
  | "triggeredRules"
>;

function withDecisionTrace(pathDecision: LegacyPathDecision): PathDecision {
  const triggeredRules = pathDecision.reasons.map((reason) => reason.code);
  return {
    ...pathDecision,
    alternativePaths: (
      [
        "RECOMMENDATION",
        "POSTGRAD_EXAM",
        "DUAL_TRACK",
        "INSUFFICIENT_DATA",
      ] as const
    ).filter((path) => path !== pathDecision.path),
    decisionReasonCodes: triggeredRules,
    missingCriticalData: [...pathDecision.missingData],
    positiveFactors:
      pathDecision.path === "INSUFFICIENT_DATA"
        ? []
        : pathDecision.reasons.map((reason) => reason.message),
    riskFactors: pathDecision.riskFlags.map((risk) => risk.message),
    rulesVersion: "rules-v0.2",
    selectedPath: pathDecision.path,
    triggeredRules,
  };
}

function uniqueRiskFlags(flags: RiskFlag[]) {
  return [...new Map(flags.map((flag) => [flag.code, flag])).values()];
}
