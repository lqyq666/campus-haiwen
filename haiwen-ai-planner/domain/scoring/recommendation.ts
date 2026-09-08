import type { StudentProfile } from "../student/schema";
import { recommendationScoringConfig as config } from "./recommendation-rules";
import {
  clampScore,
  explainScore,
  last,
  type RiskFlag,
  type ScoreReason,
  type ScoringResult,
  scoreByMinimumBand,
} from "./types";

export type RecommendationDimensions = {
  academics: number;
  competition: number;
  english: number;
  experience: number;
  research: number;
};

export type RecommendationScore = ScoringResult<RecommendationDimensions>;

export function calculateRecommendationScore(
  profile: StudentProfile
): RecommendationScore {
  const reasons: ScoreReason[] = [];
  const riskFlags: RiskFlag[] = [];
  const missingData: string[] = [];
  const academics = scoreAcademics(profile, reasons, riskFlags, missingData);
  const english = scoreEnglish(profile, reasons, riskFlags, missingData);
  const research = scoreResearch(profile, reasons, riskFlags, missingData);
  const competition = scoreCompetition(profile, reasons, riskFlags);
  const experience = scoreExperience(profile, reasons);
  const dimensions = {
    academics,
    competition,
    english,
    experience,
    research,
  };
  const total = Object.entries(config.weights).reduce(
    (sum, [dimension, weight]) =>
      sum +
      dimensions[dimension as keyof RecommendationDimensions] * (weight / 100),
    0
  );

  if (competition === 0) {
    riskFlags.push({
      code: "COMPETITION_WEAK",
      message: "尚无可用于评估的竞赛经历",
    });
  }
  if (missingData.length >= 2) {
    riskFlags.push({
      code: "PROFILE_INCOMPLETE",
      message: "关键画像信息不完整",
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
    confidence: scoreConfidence(profile),
    dimensions,
    missingData,
    reasons,
    riskFlags,
    total: normalizedTotal,
    version: config.version,
  };
}

function scoreAcademics(
  profile: StudentProfile,
  reasons: ScoreReason[],
  riskFlags: RiskFlag[],
  missingData: string[]
) {
  const { gpa, rankPercentile } = profile;
  if (rankPercentile !== undefined) {
    const band =
      config.academicRankBands.find(
        ({ maxPercentile }) => rankPercentile <= maxPercentile
      ) ?? last(config.academicRankBands);
    reasons.push({
      code: `ACADEMIC_TOP_${band.maxPercentile}_PERCENT`,
      dimension: "academics",
      impact: clampScore(band.score * (config.weights.academics / 100)),
      message: `专业排名位于前 ${rankPercentile}%`,
    });
    if (rankPercentile > 30) {
      riskFlags.push({
        code: "RANKING_WEAK",
        message: "当前专业排名竞争力偏弱",
      });
    }
    return band.score;
  }
  if (gpa !== undefined) {
    const band =
      config.academicGpaBands.find(
        ({ maxGpa, minGpa }) => gpa >= minGpa && gpa <= maxGpa
      ) ?? last(config.academicGpaBands);
    reasons.push({
      code: "ACADEMIC_GPA_FALLBACK",
      dimension: "academics",
      impact: clampScore(band.score * (config.weights.academics / 100)),
      message: "缺少排名，暂以 GPA 作为低置信度学业基础参考",
    });
    riskFlags.push({ code: "RANKING_UNKNOWN", message: "缺少专业排名信息" });
    missingData.push("rankPercentile");
    return band.score;
  }
  riskFlags.push({ code: "RANKING_UNKNOWN", message: "缺少专业排名与 GPA" });
  missingData.push("rankPercentile", "gpa");
  return 0;
}

function scoreEnglish(
  profile: StudentProfile,
  reasons: ScoreReason[],
  riskFlags: RiskFlag[],
  missingData: string[]
) {
  const isCet6 = profile.cet6Score !== undefined;
  const score = isCet6 ? profile.cet6Score : profile.cet4Score;
  if (score === undefined) {
    riskFlags.push({ code: "ENGLISH_WEAK", message: "缺少四六级成绩" });
    missingData.push("cet4Score", "cet6Score");
    return 0;
  }
  const bands = isCet6 ? config.cet6Bands : config.cet4Bands;
  const dimensionScore = scoreByMinimumBand(bands, score);
  const minScore =
    bands.find(({ minScore: threshold }) => score >= threshold)?.minScore ?? 0;
  reasons.push({
    code: isCet6 ? `ENGLISH_CET6_${minScore}` : `ENGLISH_CET4_${minScore}`,
    dimension: "english",
    impact: clampScore(dimensionScore * (config.weights.english / 100)),
    message: `${isCet6 ? "CET6" : "CET4"} 成绩 ${score}`,
  });
  if (!isCet6) {
    riskFlags.push({ code: "CET6_MISSING", message: "尚未提供 CET6 成绩" });
    missingData.push("cet6Score");
  }
  if (score < 425) {
    riskFlags.push({ code: "ENGLISH_WEAK", message: "当前英语成绩偏弱" });
  }
  return dimensionScore;
}

function scoreResearch(
  profile: StudentProfile,
  reasons: ScoreReason[],
  riskFlags: RiskFlag[],
  missingData: string[]
) {
  if (profile.researchExperiences.length === 0) {
    riskFlags.push({ code: "RESEARCH_MISSING", message: "尚无可评估科研经历" });
    missingData.push("researchExperiences");
    return 0;
  }
  const strongest = Math.max(
    ...profile.researchExperiences.map((experience) => {
      const duration = experience.durationMonths ?? 0;
      const durationScore =
        duration >= 12
          ? config.research.duration.long
          : duration >= 6
            ? config.research.duration.medium
            : config.research.duration.short;
      return (
        config.research.role[experience.role] +
        durationScore +
        (experience.output ? config.research.output : 0)
      );
    })
  );
  const score = clampScore(
    strongest +
      Math.max(0, profile.researchExperiences.length - 1) *
        config.research.countBonus
  );
  reasons.push({
    code:
      score >= 80
        ? "RESEARCH_STRONG"
        : score >= 50
          ? "RESEARCH_MEANINGFUL"
          : "RESEARCH_BASIC",
    dimension: "research",
    impact: clampScore(score * (config.weights.research / 100)),
    message: `基于 ${profile.researchExperiences.length} 段科研经历的角色、时长与成果评估`,
  });
  return score;
}

function scoreCompetition(
  profile: StudentProfile,
  reasons: ScoreReason[],
  _riskFlags: RiskFlag[]
) {
  if (profile.competitionExperiences.length === 0) {
    return 0;
  }
  const score = clampScore(
    Math.max(
      ...profile.competitionExperiences.map(
        (experience) =>
          config.competitionLevelScores[experience.level] +
          config.competitionAwardBonus
      )
    )
  );
  reasons.push({
    code: "COMPETITION_STRONGEST_RESULT",
    dimension: "competition",
    impact: clampScore(score * (config.weights.competition / 100)),
    message: "按最高竞赛级别和已获奖项评估",
  });
  return score;
}

function scoreExperience(profile: StudentProfile, reasons: ScoreReason[]) {
  const paperScore = profile.papers.reduce(
    (highest, paper) =>
      Math.max(
        highest,
        config.experience.paperStatus[paper.status] +
          config.experience.paperAuthorshipBonus[paper.authorship]
      ),
    0
  );
  const internshipScore = profile.internships.reduce(
    (highest, internship) =>
      Math.max(
        highest,
        config.experience.internshipRelevance[internship.relevance]
      ),
    0
  );
  const researchOutputBonus = profile.researchExperiences.some(
    (experience) => experience.output
  )
    ? config.experience.researchOutputBonus
    : 0;
  const score = clampScore(
    Math.max(paperScore, internshipScore) + researchOutputBonus
  );
  reasons.push({
    code: "EXPERIENCE_OUTPUT_AND_PRACTICE",
    dimension: "experience",
    impact: clampScore(score * (config.weights.experience / 100)),
    message: "该维度仅衡量论文成果与实习实践，科研参与主体分计入科研维度",
  });
  return score;
}

function scoreConfidence(profile: StudentProfile) {
  let confidence = config.confidence.base;
  if (profile.rankPercentile !== undefined) {
    confidence += config.confidence.ranking;
  } else if (profile.gpa !== undefined) {
    confidence += config.confidence.gpaOnlyAcademic;
  }
  if (profile.cet4Score !== undefined || profile.cet6Score !== undefined) {
    confidence += config.confidence.english;
  }
  if (profile.researchExperiences.length > 0) {
    confidence += config.confidence.research;
  }
  if (profile.competitionExperiences.length > 0) {
    confidence += config.confidence.competition;
  }
  if (profile.papers.length + profile.internships.length > 0) {
    confidence += config.confidence.experience;
  }
  return clampScore(confidence);
}
