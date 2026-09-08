import { toVerifiedEvidence } from "@/domain/evidence/metadata";
import type {
  ActionPriority,
  AssessmentReport,
  AssessmentReportInput,
  AssessmentReportValidation,
  SchoolMatchRisk,
} from "./models";

export const assessmentReportVersion = "assessment-report-v0.2" as const;

export function createAssessmentReport(
  input: AssessmentReportInput
): AssessmentReport {
  const sources = new Map(
    input.sourceDocuments.map((source) => [source.id, source])
  );
  const [latestOfficialYear] = input.sourceDocuments
    .map((source) => source.admissionYear)
    .filter((year): year is number => year !== undefined)
    .filter((year) => year <= input.admissionYear)
    .sort((left, right) => right - left);
  const verifiedEvidence = input.evidence
    .map((evidence) =>
      toVerifiedEvidence(evidence, sources.get(evidence.sourceDocumentId), {
        latestOfficialYear,
        targetAdmissionYear: input.admissionYear,
      })
    )
    .filter((evidence) => evidence !== undefined);
  const evidenceIndex = Object.fromEntries(
    verifiedEvidence.map((evidence) => [evidence.id, evidence])
  );
  const topRisks = uniqueRisks(
    input.schoolRecommendations.flatMap(
      (recommendation) => recommendation.riskFlags
    )
  );
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  return {
    actionPriorities: [...input.actionPriorities],
    assessmentVersion: "assessment-v0.2",
    createdAt: generatedAt,
    evidenceIndex,
    evidenceVersion: "evidence-v0.2",
    generatedAt,
    missingData: [
      ...new Set(
        input.schoolRecommendations.flatMap(
          (recommendation) => recommendation.missingData
        )
      ),
    ].sort(),
    pathDecision: input.assessmentResult.pathDecision,
    postgraduateExamScore: input.assessmentResult.postgraduateExamScore,
    profileCompleteness: input.assessmentResult.profileCompleteness,
    recommendationScore: input.assessmentResult.recommendationScore,
    reportVersion: assessmentReportVersion,
    rulesVersion: "rules-v0.2",
    schoolDataVersion:
      input.schoolDataVersion ??
      input.schoolRecommendations[0]?.schoolDataVersion ??
      "real-school-data-v0.1",
    schoolRecommendations: [...input.schoolRecommendations],
    studentSummary: {
      grade: input.profile.grade,
      targetCities: input.profile.targetCities,
      targetMajors: input.profile.targetMajors,
      targetUniversities: input.profile.targetUniversities,
    },
    topRisks,
  };
}

export function createActionPriorities(
  recommendations: AssessmentReportInput["schoolRecommendations"],
  profile: AssessmentReportInput["profile"]
): ActionPriority[] {
  const risks = new Set(
    recommendations.flatMap((item) => item.riskFlags.map((risk) => risk.code))
  );
  const evidenceIds = [
    ...new Set(recommendations.flatMap((item) => item.evidenceIds)),
  ].sort();
  const priorities: Omit<ActionPriority, "priority">[] = [];
  if (
    risks.has("HARD_POLICY_MISMATCH") ||
    risks.has("ENGLISH_REQUIREMENT_UNKNOWN")
  ) {
    priorities.push({
      action: "完成一次 CET6 模考或正式考试，并记录分项成绩与薄弱题型。",
      code: "IMPROVE_ENGLISH",
      evidenceIds,
      reason: "候选政策存在明确或待确认的英语要求。",
      relatedRisk: risks.has("HARD_POLICY_MISMATCH")
        ? "HARD_POLICY_MISMATCH"
        : "ENGLISH_REQUIREMENT_UNKNOWN",
      successSignal:
        "获得一份可核验的总分与分项成绩记录，并形成下一轮提升清单。",
      timeWindow: "DAYS_0_30",
      title: "补齐并提升 CET6 成绩",
      why: "候选政策存在明确或待确认的英语要求。",
    });
  }
  if (risks.has("PROFILE_INCOMPLETE")) {
    priorities.push({
      action: "补录成绩排名口径、科研/竞赛角色、目标毕业年份和每周可投入时间。",
      code: "COMPLETE_PROFILE",
      evidenceIds: [],
      reason: "学生画像不完整会降低匹配结论的置信度。",
      relatedRisk: "PROFILE_INCOMPLETE",
      successSignal:
        "报告缺失字段清单清零，且画像完整度重新计算后达到 80 分以上。",
      timeWindow: "DAYS_0_30",
      title: "补充关键学生画像信息",
      why: "学生画像不完整会降低匹配结论的置信度。",
    });
  }
  if (risks.has("POLICY_DATA_MISSING") || risks.has("LIMITED_EVIDENCE")) {
    priorities.push({
      action:
        "逐项打开报告中的官方来源，核对招生年度、报名条件和材料截止时间。",
      code: "VERIFY_POLICY",
      evidenceIds,
      reason: "部分候选缺少当前年度政策或证据覆盖。",
      relatedRisk: risks.has("POLICY_DATA_MISSING")
        ? "POLICY_DATA_MISSING"
        : "LIMITED_EVIDENCE",
      successSignal:
        "为每个候选项目记录官方链接、发布日期、关键条件和待确认项。",
      timeWindow: "DAYS_0_30",
      title: "核验当前招生年度政策",
      why: "部分候选缺少当前年度政策或证据覆盖。",
    });
  }
  if (
    profile.targetCities.length +
      profile.targetMajors.length +
      profile.targetUniversities.length ===
    0
  ) {
    priorities.push({
      action: "确定 2 个目标城市、1–2 个专业方向，并列出不超过 8 个候选项目。",
      code: "CLARIFY_TARGETS",
      evidenceIds: [],
      reason: "缺少目标城市、院校或专业会降低目标匹配精度。",
      relatedRisk: "TARGET_SCOPE_UNCLEAR",
      successSignal:
        "形成含城市、专业、项目与选择理由的候选清单，并可用于重新匹配。",
      timeWindow: "DAYS_0_30",
      title: "明确目标城市、院校与专业",
      why: "缺少目标城市、院校或专业会降低目标匹配精度。",
    });
  }
  priorities.push(
    {
      action: "按目标项目整理成绩单、排名证明、英语成绩和代表性项目材料目录。",
      code: "BUILD_EVIDENCE_BASELINE",
      evidenceIds: [],
      reason: "统一材料基线能尽早暴露缺件，并为后续复核保留可验证依据。",
      relatedRisk: null,
      successSignal:
        "每类材料都有文件、负责人或预计取得日期，且缺件有明确补齐计划。",
      timeWindow: "DAYS_0_30",
      title: "建立申请材料基线",
      why: "统一材料基线能尽早暴露缺件，并为后续复核保留可验证依据。",
    },
    {
      action:
        "用最新成绩和政策重新评估候选项目，保留冲刺、匹配、保守各至少 1 项。",
      code: "VALIDATE_TARGET_SHORTLIST",
      evidenceIds,
      reason: "目标组合需要随成绩和政策变化校准，避免只押注单一路径。",
      relatedRisk: null,
      successSignal:
        "形成分层候选表，每个项目都有保留/移除理由及最新官方依据。",
      timeWindow: "DAYS_31_60",
      title: "校准分层候选清单",
      why: "目标组合需要随成绩和政策变化校准，避免只押注单一路径。",
    },
    {
      action:
        "复盘英语、排名、科研/竞赛和材料完成度，并据此更新未来 30 天任务。",
      code: "RUN_PROGRESS_REVIEW",
      evidenceIds: [],
      reason: "阶段复盘可以把变化重新送入评分与匹配，防止计划与现实脱节。",
      relatedRisk: null,
      successSignal:
        "完成一次新版测评，记录分数变化、风险变化和下一阶段前三项任务。",
      timeWindow: "DAYS_61_90",
      title: "完成 90 天进度复盘",
      why: "阶段复盘可以把变化重新送入评分与匹配，防止计划与现实脱节。",
    }
  );
  return priorities.map((priority, index) => ({
    ...priority,
    priority: index + 1,
  }));
}

export function validateAssessmentReport(
  report: AssessmentReport | null,
  knownProgramIds?: readonly string[]
): AssessmentReportValidation {
  const issues: string[] = [];
  if (!report?.reportVersion) {
    issues.push("reportVersion is required");
  }
  if (!report || Number.isNaN(Date.parse(report.generatedAt))) {
    issues.push("generatedAt must be a valid ISO date");
  }
  if (!report) {
    return { issues, valid: false };
  }
  for (const score of [
    report.profileCompleteness.score,
    report.recommendationScore.total,
    report.recommendationScore.confidence,
    report.postgraduateExamScore.total,
    report.postgraduateExamScore.confidence,
    ...report.schoolRecommendations.flatMap((item) => [
      item.score,
      item.confidence,
    ]),
  ]) {
    if (!(score >= 0 && score <= 100)) {
      issues.push("scores must be between 0 and 100");
    }
  }
  for (const recommendation of report.schoolRecommendations) {
    if (!recommendation.programId) {
      issues.push("recommendation programId is required");
    }
    if (
      knownProgramIds &&
      !knownProgramIds.includes(recommendation.programId)
    ) {
      issues.push(`unknown programId ${recommendation.programId}`);
    }
    if (!recommendation.scoringVersion) {
      issues.push("recommendation scoringVersion is required");
    }
    if (
      !["STRETCH", "MATCH", "CONSERVATIVE", "INSUFFICIENT_DATA"].includes(
        recommendation.tier
      )
    ) {
      issues.push(
        `invalid recommendation tier for ${recommendation.programId}`
      );
    }
    for (const evidenceId of recommendation.evidenceIds) {
      if (!report.evidenceIndex[evidenceId]) {
        issues.push(`unknown evidenceId ${evidenceId}`);
      }
    }
  }
  return { issues: [...new Set(issues)], valid: issues.length === 0 };
}

function uniqueRisks(risks: SchoolMatchRisk[]) {
  return [...new Map(risks.map((risk) => [risk.code, risk])).values()];
}
