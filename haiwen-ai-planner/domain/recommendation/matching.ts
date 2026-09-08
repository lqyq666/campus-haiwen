import type { CandidateProgram } from "@/domain/school/repository";
import { clampScore } from "@/domain/scoring/types";
import { schoolMatchingConfig as config } from "./matching-config";
import type {
  EligibilityStatus,
  EvidenceCoverage,
  SchoolMatchingInput,
  SchoolMatchReason,
  SchoolMatchResult,
  SchoolMatchRisk,
  SchoolMatchTier,
} from "./models";

export function matchSchoolCandidates(
  input: SchoolMatchingInput
): SchoolMatchResult[] {
  return rankSchoolMatches(
    input.candidates.map((candidate) => matchCandidate(candidate, input))
  );
}

export function rankSchoolMatches(
  matches: readonly SchoolMatchResult[]
): SchoolMatchResult[] {
  const byTier = new Map<SchoolMatchTier, SchoolMatchResult[]>();
  for (const match of [...matches].sort(compareMatches)) {
    const current = byTier.get(match.tier) ?? [];
    if (current.length < config.maxRecommendationsPerTier) {
      current.push(match);
      byTier.set(match.tier, current);
    }
  }
  return ["MATCH", "CONSERVATIVE", "STRETCH", "INSUFFICIENT_DATA"]
    .flatMap((tier) => byTier.get(tier as SchoolMatchTier) ?? [])
    .slice(0, config.maxRecommendations);
}

function matchCandidate(
  candidate: CandidateProgram,
  input: SchoolMatchingInput
): SchoolMatchResult {
  const reasons: SchoolMatchReason[] = [];
  const risks: SchoolMatchRisk[] = [
    {
      code: "HISTORICAL_ADMISSION_DATA_MISSING",
      message: "当前没有历史录取分布，匹配层级不是录取概率。",
    },
  ];
  const missingData: string[] = ["historicalAdmissionData"];
  const evidenceIds = [
    ...new Set(candidate.evidence.map((item) => item.id)),
  ].sort();
  const coverage = evidenceCoverage(candidate);
  const profileStrength = profileScore(input, reasons, risks, missingData);
  const alignment = targetAlignment(candidate, input, reasons);
  const eligibility = policyEligibility(
    candidate,
    input,
    reasons,
    risks,
    missingData
  );
  const policyFit = policyScore(
    candidate,
    eligibility,
    coverage,
    risks,
    missingData
  );
  const evidenceQuality = coverageScore(coverage, reasons, risks);
  const score = weightedScore({
    evidenceQuality,
    policyFit,
    profileStrength,
    targetAlignment: alignment,
  });
  const confidence = confidenceScore(input, coverage, candidate, risks);
  const confidenceLevel =
    confidence >= config.confidence.high
      ? "HIGH"
      : confidence >= config.confidence.medium
        ? "MEDIUM"
        : "LOW";
  const hasCurrentPolicy =
    candidate.admissionPolicy?.admissionYear === input.admissionYear ||
    candidate.recommendationPolicies.some(
      (policy) => policy.admissionYear === input.admissionYear
    );
  if (!hasCurrentPolicy) {
    risks.push({
      code: "ADMISSION_YEAR_MISMATCH",
      message: "候选政策不属于请求的招生年度。",
    });
    missingData.push("admissionYearPolicy");
  }
  const tier = tierFor(score, eligibility, candidate, input);
  if (
    tier === "INSUFFICIENT_DATA" &&
    !risks.some((risk) => risk.code === "POLICY_DATA_MISSING")
  ) {
    risks.push({
      code: "POLICY_DATA_MISSING",
      message: "缺少当前招生年度的可用政策，无法形成相对匹配层级。",
    });
    missingData.push("currentYearPolicy");
  }
  return {
    confidence,
    confidenceLevel,
    departmentId: candidate.department.id,
    dimensions: {
      evidenceQuality,
      policyFit,
      profileStrength,
      targetAlignment: alignment,
    },
    eligibility,
    evidenceCoverage: coverage,
    evidenceIds,
    matchingVersion: "program-matching-v0.2",
    missingData: [...new Set(missingData)].sort(),
    positiveFactors: reasons,
    programId: candidate.program.id,
    programName: candidate.program.name,
    reasons,
    riskFactors: uniqueRisks(risks),
    riskFlags: uniqueRisks(risks),
    rulesVersion: "rules-v0.2",
    schoolDataVersion:
      input.schoolDataVersion ?? inferSchoolDataVersion(input.candidates),
    schoolId: candidate.university.id,
    score,
    scoringVersion: config.version,
    tier,
    universityId: candidate.university.id,
  };
}

function profileScore(
  input: SchoolMatchingInput,
  reasons: SchoolMatchReason[],
  risks: SchoolMatchRisk[],
  missingData: string[]
) {
  const { pathDecision, postgraduateExamScore, recommendationScore } =
    input.assessmentResult;
  const score =
    pathDecision.path === "RECOMMENDATION"
      ? recommendationScore.total
      : pathDecision.path === "POSTGRAD_EXAM"
        ? postgraduateExamScore.total
        : pathDecision.path === "DUAL_TRACK"
          ? (recommendationScore.total + postgraduateExamScore.total) / 2
          : Math.min(recommendationScore.total, postgraduateExamScore.total);
  if (score >= 70) {
    reasons.push({
      code: "STRONG_PROFILE",
      message: "当前路径对应的 M2 能力评分达到较强基线。",
    });
  }
  if (input.assessmentResult.profileCompleteness.score < 80) {
    risks.push({
      code: "PROFILE_INCOMPLETE",
      message: "学生画像尚不完整，匹配结论置信度受限。",
    });
    missingData.push(
      ...input.assessmentResult.profileCompleteness.missingCriticalFields
    );
    reasons.push({
      code: "PROFILE_DATA_INCOMPLETE",
      message: "部分关键学生画像数据尚未提供。",
    });
  }
  return clampScore(score);
}

function targetAlignment(
  candidate: CandidateProgram,
  input: SchoolMatchingInput,
  reasons: SchoolMatchReason[]
) {
  const parts: number[] = [];
  const { profile } = input;
  if (profile.targetCities.length) {
    const hit = profile.targetCities.some((city) =>
      candidate.university.city?.includes(city)
    );
    parts.push(hit ? 100 : 0);
    if (hit) {
      reasons.push({
        code: "TARGET_CITY_MATCH",
        message: "候选项目符合目标城市。",
      });
    }
  }
  if (profile.targetUniversities.length) {
    const hit = profile.targetUniversities.some((name) =>
      candidate.university.name.includes(name)
    );
    parts.push(hit ? 100 : 0);
    if (hit) {
      reasons.push({
        code: "TARGET_UNIVERSITY_MATCH",
        message: "候选项目符合目标院校。",
      });
    }
  }
  if (profile.targetMajors.length) {
    const hit = profile.targetMajors.some((major) =>
      candidate.program.name.includes(major)
    );
    parts.push(hit ? 100 : 0);
    if (hit) {
      reasons.push({
        code: "TARGET_MAJOR_MATCH",
        message: "候选项目符合目标专业。",
      });
    }
  }
  return parts.length
    ? clampScore(parts.reduce((sum, item) => sum + item, 0) / parts.length)
    : 50;
}

function policyEligibility(
  candidate: CandidateProgram,
  input: SchoolMatchingInput,
  reasons: SchoolMatchReason[],
  risks: SchoolMatchRisk[],
  missingData: string[]
): EligibilityStatus {
  const policies = candidate.recommendationPolicies.filter(
    (policy) => policy.admissionYear === input.admissionYear
  );
  const english = policies
    .map((policy) => policy.englishRequirement)
    .filter(Boolean);
  const explicitThresholds = english
    .map((requirement) =>
      requirement ? parseCet6Threshold(requirement) : undefined
    )
    .filter((threshold): threshold is number => threshold !== undefined);
  if (explicitThresholds.length) {
    const required = Math.max(...explicitThresholds);
    if (input.profile.cet6Score === undefined) {
      risks.push({
        code: "ENGLISH_REQUIREMENT_UNKNOWN",
        message: `政策要求 CET6 ≥ ${required}，但未提供 CET6 成绩。`,
      });
      missingData.push("cet6Score");
      reasons.push({
        code: "ENGLISH_REQUIREMENT_UNKNOWN",
        message: "无法确认是否满足明确的 CET6 门槛。",
      });
      return "UNKNOWN";
    }
    if (input.profile.cet6Score < required) {
      risks.push({
        code: "HARD_POLICY_MISMATCH",
        message: `CET6 ${input.profile.cet6Score} 未达到政策明确要求的 ${required}。`,
      });
      return "FAIL";
    }
    reasons.push({
      code: "ENGLISH_REQUIREMENT_MET",
      message: `CET6 ${input.profile.cet6Score} 满足政策明确门槛 ${required}。`,
    });
    return "PASS";
  }
  if (english.length) {
    risks.push({
      code: "ENGLISH_REQUIREMENT_UNKNOWN",
      message: "英语要求为自然语言，当前无法确定性量化。",
    });
    reasons.push({
      code: "ENGLISH_REQUIREMENT_UNKNOWN",
      message: "英语政策未提供可验证的数值门槛。",
    });
    return "UNKNOWN";
  }
  return policies.length ? "UNKNOWN" : "NOT_APPLICABLE";
}

function policyScore(
  candidate: CandidateProgram,
  eligibility: EligibilityStatus,
  coverage: EvidenceCoverage,
  risks: SchoolMatchRisk[],
  missingData: string[]
) {
  const hasCurrentAdmission =
    candidate.admissionPolicy?.admissionYear !== undefined;
  const hasCurrentRecommendation = candidate.recommendationPolicies.length > 0;
  if (!(hasCurrentAdmission || hasCurrentRecommendation)) {
    risks.push({
      code: "POLICY_DATA_MISSING",
      message: "没有当前年度招生或推免政策。",
    });
    missingData.push("currentYearPolicy");
    return 0;
  }
  if (eligibility === "FAIL") {
    return 0;
  }
  if (eligibility === "UNKNOWN") {
    return coverage.recommendationPolicy ? 60 : 45;
  }
  return 100;
}

function evidenceCoverage(candidate: CandidateProgram): EvidenceCoverage {
  const sourceIds = new Set(
    candidate.evidence.map((item) => item.sourceDocumentId)
  );
  const recommendationPolicy = candidate.recommendationPolicies.some((policy) =>
    sourceIds.has(policy.sourceDocumentId)
  );
  return {
    admissionPolicy: Boolean(
      candidate.admissionPolicy &&
        sourceIds.has(candidate.admissionPolicy.sourceDocumentId)
    ),
    englishRequirement: candidate.recommendationPolicies.some(
      (policy) =>
        Boolean(policy.englishRequirement) &&
        sourceIds.has(policy.sourceDocumentId)
    ),
    recommendationPolicy,
  };
}

function coverageScore(
  coverage: EvidenceCoverage,
  reasons: SchoolMatchReason[],
  risks: SchoolMatchRisk[]
) {
  const present = Object.values(coverage).filter(Boolean).length;
  if (present) {
    reasons.push({
      code: "POLICY_EVIDENCE_PRESENT",
      message: "候选政策存在可追溯的证据片段。",
    });
  }
  if (present < 2) {
    risks.push({
      code: "LIMITED_EVIDENCE",
      message: "当前候选的政策证据覆盖有限。",
    });
    reasons.push({
      code: "LIMITED_EVIDENCE",
      message: "部分政策结论缺少对应证据。",
    });
  }
  return clampScore((present / 3) * 100);
}

function weightedScore(dimensions: SchoolMatchResult["dimensions"]) {
  return clampScore(
    Object.entries(config.weights).reduce(
      (total, [dimension, weight]) =>
        total +
        dimensions[dimension as keyof typeof dimensions] * (weight / 100),
      0
    )
  );
}

function confidenceScore(
  input: SchoolMatchingInput,
  coverage: EvidenceCoverage,
  candidate: CandidateProgram,
  risks: SchoolMatchRisk[]
) {
  const policyPresent =
    candidate.admissionPolicy?.admissionYear === input.admissionYear ||
    candidate.recommendationPolicies.some(
      (policy) => policy.admissionYear === input.admissionYear
    );
  const evidenceScore =
    (Object.values(coverage).filter(Boolean).length / 3) *
    config.confidence.evidenceCoverage;
  const policyConfidence = policyPresent ? config.confidence.policyCoverage : 0;
  if (!policyPresent) {
    risks.push({ code: "POLICY_DATA_MISSING", message: "当前年度政策缺失。" });
  }
  return clampScore(
    (input.assessmentResult.profileCompleteness.score / 100) *
      config.confidence.profileCompleteness +
      policyConfidence +
      evidenceScore
  );
}

function tierFor(
  score: number,
  eligibility: EligibilityStatus,
  candidate: CandidateProgram,
  input: SchoolMatchingInput
): SchoolMatchTier {
  if (eligibility === "FAIL") {
    return "INSUFFICIENT_DATA";
  }
  const hasCurrentPolicy =
    candidate.admissionPolicy?.admissionYear === input.admissionYear ||
    candidate.recommendationPolicies.some(
      (policy) => policy.admissionYear === input.admissionYear
    );
  if (!hasCurrentPolicy) {
    return "INSUFFICIENT_DATA";
  }
  const adjustment =
    config.riskPreference[input.profile.riskPreference ?? "BALANCED"];
  if (score >= config.tierThresholds.conservative + adjustment.conservative) {
    return "CONSERVATIVE";
  }
  if (score >= config.tierThresholds.match + adjustment.match) {
    return "MATCH";
  }
  return "STRETCH";
}

function parseCet6Threshold(requirement: string) {
  const match = requirement.match(/CET6\s*(?:不低于|≥|>=|不低於)?\s*(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

function compareMatches(left: SchoolMatchResult, right: SchoolMatchResult) {
  const eligibilityRank = {
    FAIL: 0,
    NOT_APPLICABLE: 2,
    PASS: 3,
    UNKNOWN: 1,
  } as const;
  const tierRank = {
    CONSERVATIVE: 2,
    INSUFFICIENT_DATA: 0,
    MATCH: 3,
    STRETCH: 1,
  } as const;
  return (
    eligibilityRank[right.eligibility] - eligibilityRank[left.eligibility] ||
    tierRank[right.tier] - tierRank[left.tier] ||
    right.score - left.score ||
    right.confidence - left.confidence ||
    right.dimensions.targetAlignment - left.dimensions.targetAlignment ||
    left.programId.localeCompare(right.programId)
  );
}

function uniqueRisks(risks: SchoolMatchRisk[]) {
  return [...new Map(risks.map((risk) => [risk.code, risk])).values()];
}

function inferSchoolDataVersion(candidates: readonly CandidateProgram[]) {
  return candidates.length > 0 &&
    candidates.every((candidate) => candidate.program.id.startsWith("real:"))
    ? "real-school-data-v0.1"
    : "school-data-fixture-v0.1";
}
