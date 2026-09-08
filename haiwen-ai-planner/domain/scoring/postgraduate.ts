import type { StudentProfile } from "../student/schema";
import { postgraduateScoringConfig as config } from "./postgraduate-rules";
import { recommendationScoringConfig } from "./recommendation-rules";
import {
  clampScore,
  explainScore,
  last,
  type RiskFlag,
  type ScoreReason,
  type ScoringResult,
  scoreByMinimumBand,
} from "./types";

export type PostgraduateExamDimensions = {
  academicFoundation: number;
  englishFoundation: number;
  preparationTime: number;
  studyCapacity: number;
  targetClarity: number;
};

export type PostgraduateExamScore = ScoringResult<PostgraduateExamDimensions>;

export function calculatePostgraduateExamScore(
  profile: StudentProfile
): PostgraduateExamScore {
  const reasons: ScoreReason[] = [];
  const riskFlags: RiskFlag[] = [
    {
      code: "SUBJECT_FOUNDATION_UNKNOWN",
      message: "数学、专业课与政治基础尚未采集",
    },
  ];
  const missingData = [
    "mathematicsFoundation",
    "majorCourseFoundation",
    "politicsFoundation",
  ];
  const academicFoundation = academicScore(profile, reasons, missingData);
  const englishFoundation = englishScore(
    profile,
    reasons,
    riskFlags,
    missingData
  );
  const preparationTime = timeScore(profile, reasons, riskFlags, missingData);
  const studyCapacity = studyScore(profile, reasons, riskFlags, missingData);
  const targetClarity = targetScore(profile, reasons, riskFlags, missingData);
  const dimensions = {
    academicFoundation,
    englishFoundation,
    preparationTime,
    studyCapacity,
    targetClarity,
  };
  const total = Object.entries(config.weights).reduce(
    (sum, [dimension, weight]) =>
      sum +
      dimensions[dimension as keyof PostgraduateExamDimensions] *
        (weight / 100),
    0
  );

  if (missingData.length >= 6) {
    riskFlags.push({
      code: "PROFILE_INCOMPLETE",
      message: "考研准备度信息不完整",
    });
  }

  const normalizedTotal = clampScore(total);
  return {
    ...explainScore({
      dimensions,
      modelVersion: config.version,
      reasons,
      total: normalizedTotal,
      weights: config.weights,
    }),
    confidence: confidenceScore(profile),
    dimensions,
    missingData,
    reasons,
    riskFlags,
    total: normalizedTotal,
    version: config.version,
  };
}

function academicScore(
  profile: StudentProfile,
  reasons: ScoreReason[],
  missingData: string[]
) {
  let score = 0;
  let code = "ACADEMIC_FOUNDATION_UNKNOWN";
  let message = "缺少 GPA 与排名";
  const { gpa, rankPercentile } = profile;
  if (rankPercentile !== undefined) {
    const { score: rankScore } =
      recommendationScoringConfig.academicRankBands.find(
        ({ maxPercentile }) => rankPercentile <= maxPercentile
      ) ?? last(recommendationScoringConfig.academicRankBands);
    score = rankScore;
    code = "ACADEMIC_FOUNDATION_RANK";
    message = `以专业排名前 ${profile.rankPercentile}% 评估通用学业基础`;
  } else if (gpa === undefined) {
    missingData.push("rankPercentile", "gpa");
  } else {
    const { score: gpaScore } =
      recommendationScoringConfig.academicGpaBands.find(
        ({ maxGpa, minGpa }) => gpa >= minGpa && gpa <= maxGpa
      ) ?? last(recommendationScoringConfig.academicGpaBands);
    score = gpaScore;
    code = "ACADEMIC_FOUNDATION_GPA";
    message = "缺少排名，暂以 GPA 评估通用学业基础";
  }
  reasons.push({
    code,
    dimension: "academicFoundation",
    impact: clampScore(score * (config.weights.academicFoundation / 100)),
    message,
  });
  return score;
}

function englishScore(
  profile: StudentProfile,
  reasons: ScoreReason[],
  riskFlags: RiskFlag[],
  missingData: string[]
) {
  const isCet6 = profile.cet6Score !== undefined;
  const rawScore = isCet6 ? profile.cet6Score : profile.cet4Score;
  if (rawScore === undefined) {
    missingData.push("cet4Score", "cet6Score");
    riskFlags.push({ code: "ENGLISH_WEAK", message: "缺少英语基础数据" });
    return 0;
  }
  const bands = isCet6
    ? recommendationScoringConfig.cet6Bands
    : recommendationScoringConfig.cet4Bands;
  const score = scoreByMinimumBand(bands, rawScore);
  reasons.push({
    code: isCet6 ? "ENGLISH_FOUNDATION_CET6" : "ENGLISH_FOUNDATION_CET4",
    dimension: "englishFoundation",
    impact: clampScore(score * (config.weights.englishFoundation / 100)),
    message: `以 ${isCet6 ? "CET6" : "CET4"} ${rawScore} 评估英语基础`,
  });
  if (rawScore < 425) {
    riskFlags.push({ code: "ENGLISH_WEAK", message: "当前英语基础偏弱" });
  }
  return score;
}

function timeScore(
  profile: StudentProfile,
  reasons: ScoreReason[],
  riskFlags: RiskFlag[],
  missingData: string[]
) {
  if (!profile.grade) {
    missingData.push("grade");
    return 0;
  }
  const score = config.gradeTimeScores[profile.grade];
  reasons.push({
    code: `PREPARATION_WINDOW_${profile.grade}`,
    dimension: "preparationTime",
    impact: clampScore(score * (config.weights.preparationTime / 100)),
    message: `按当前年级 ${profile.grade} 评估可用准备窗口`,
  });
  if (profile.grade === "SENIOR" || profile.grade === "GRADUATED") {
    riskFlags.push({
      code: "TIME_WINDOW_SHORT",
      message: "当前准备时间窗口较短",
    });
  }
  return score;
}

function studyScore(
  profile: StudentProfile,
  reasons: ScoreReason[],
  riskFlags: RiskFlag[],
  missingData: string[]
) {
  const { dailyStudyHours } = profile;
  if (dailyStudyHours === undefined) {
    missingData.push("dailyStudyHours");
    riskFlags.push({ code: "STUDY_TIME_LOW", message: "未提供每日可学习时长" });
    return 0;
  }
  const { score } =
    config.studyHourBands.find(({ minHours }) => dailyStudyHours >= minHours) ??
    last(config.studyHourBands);
  reasons.push({
    code: "STUDY_CAPACITY_DAILY_HOURS",
    dimension: "studyCapacity",
    impact: clampScore(score * (config.weights.studyCapacity / 100)),
    message: `每日可投入 ${dailyStudyHours} 小时`,
  });
  if (dailyStudyHours < 2) {
    riskFlags.push({ code: "STUDY_TIME_LOW", message: "每日学习投入偏低" });
  }
  return score;
}

function targetScore(
  profile: StudentProfile,
  reasons: ScoreReason[],
  riskFlags: RiskFlag[],
  missingData: string[]
) {
  const dimensions = [
    profile.targetCities.length > 0,
    profile.targetUniversities.length > 0,
    profile.targetMajors.length > 0,
  ].filter(Boolean).length;
  const score =
    dimensions === 3
      ? config.targetClarityScores.all
      : dimensions === 2
        ? config.targetClarityScores.two
        : dimensions === 1
          ? config.targetClarityScores.one
          : config.targetClarityScores.none;
  reasons.push({
    code: `TARGET_CLARITY_${dimensions}`,
    dimension: "targetClarity",
    impact: clampScore(score * (config.weights.targetClarity / 100)),
    message: `目标城市、院校、专业中已明确 ${dimensions} 类`,
  });
  if (dimensions === 0) {
    riskFlags.push({ code: "TARGET_UNCLEAR", message: "目标方向尚不明确" });
    missingData.push("targetCities", "targetUniversities", "targetMajors");
  }
  return score;
}

function confidenceScore(profile: StudentProfile) {
  let confidence = config.confidence.base;
  if (profile.rankPercentile !== undefined || profile.gpa !== undefined) {
    confidence += config.confidence.academic;
  }
  if (profile.cet4Score !== undefined || profile.cet6Score !== undefined) {
    confidence += config.confidence.english;
  }
  if (profile.dailyStudyHours !== undefined) {
    confidence += config.confidence.studyHours;
  }
  if (
    profile.targetCities.length +
      profile.targetUniversities.length +
      profile.targetMajors.length >
    0
  ) {
    confidence += config.confidence.targets;
  }
  return clampScore(confidence);
}
