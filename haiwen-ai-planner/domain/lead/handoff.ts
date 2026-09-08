import type { AssessmentReport } from "@/domain/recommendation/models";
import type { StudentProfile } from "@/domain/student/schema";
import type {
  ConsultationContext,
  LeadHandoffContext,
  LeadScore,
} from "./models";

export function createLeadHandoffContext(
  leadId: string,
  report: AssessmentReport,
  leadScore: LeadScore,
  profile?: StudentProfile,
  consultationContext: ConsultationContext = { requestedReview: false }
): LeadHandoffContext {
  const topics = new Set<string>();
  if (report.pathDecision.path === "DUAL_TRACK") {
    topics.add("考研与保研双轨资源分配");
  }
  for (const risk of report.topRisks) {
    if (risk.code === "HARD_POLICY_MISMATCH") {
      topics.add("当前目标院校资格条件");
    }
    if (risk.code === "ENGLISH_REQUIREMENT_UNKNOWN") {
      topics.add("英语成绩对目标申请的影响");
    }
    if (risk.code === "PROFILE_INCOMPLETE") {
      topics.add("科研与画像补强窗口");
    }
  }
  const topGoals = [
    ...report.studentSummary.targetMajors.map((value) => `目标专业：${value}`),
    ...report.studentSummary.targetUniversities.map(
      (value) => `目标院校：${value}`
    ),
    ...report.studentSummary.targetCities.map((value) => `目标城市：${value}`),
  ];
  const recommendedConversationTopics = [...topics];
  const primaryGoal = topGoals[0] ?? "升学路径";
  const researchSummary = profile?.researchExperiences.length
    ? profile.researchExperiences.map((item) => item.title).join("、")
    : "无";
  const competitionSummary = profile?.competitionExperiences.length
    ? profile.competitionExperiences.map((item) => item.name).join("、")
    : "无";
  const ranking = profile?.rank
    ? `${profile.rank}/${profile.cohortSize ?? "总人数待补"}`
    : "未提供";
  const gradeLabels = {
    FRESHMAN: "大一",
    GRADUATED: "已毕业",
    JUNIOR: "大三",
    SENIOR: "大四",
    SOPHOMORE: "大二",
  } as const;
  const pathLabels = {
    DUAL_TRACK: "双轨准备",
    INSUFFICIENT_DATA: "信息不足",
    POSTGRAD_EXAM: "考研",
    RECOMMENDATION: "保研",
  } as const;
  const preferenceLabels = {
    DUAL_TRACK: "两边都考虑",
    POSTGRAD_EXAM: "主要考虑考研",
    RECOMMENDATION: "主要考虑保研",
    UNDECIDED: "暂时不知道",
  } as const;
  const cet6Labels = {
    FAILED: "未通过",
    NOT_TAKEN: "未参加",
    PASSED: "已通过",
    TAKEN_UNKNOWN: "已参加（分数未知）",
    UNKNOWN: "未知",
  } as const;
  const mainRisks = report.topRisks.slice(0, 3).map((item) => item.message);
  const priorityTopics =
    recommendedConversationTopics.length > 0
      ? recommendedConversationTopics
      : report.actionPriorities
          .filter((item) => item.timeWindow === "DAYS_0_30")
          .slice(0, 3)
          .map((item) => item.title);
  const advisorSummary = profile
    ? [
        profile.school ?? "本科院校未提供",
        profile.college,
        profile.major,
        profile.grade ? gradeLabels[profile.grade] : undefined,
        `排名 ${ranking}`,
        consultationContext.currentConcern
          ? `当前问题：${consultationContext.currentConcern}`
          : undefined,
        consultationContext.specificBlocker
          ? `具体卡点：${consultationContext.specificBlocker}`
          : undefined,
        consultationContext.decisionDeadline
          ? `判断期限：${consultationContext.decisionDeadline}`
          : undefined,
        consultationContext.attemptedAction
          ? `已做尝试：${consultationContext.attemptedAction}`
          : undefined,
        consultationContext.biggestWorry
          ? `最大顾虑：${consultationContext.biggestWorry}`
          : undefined,
        consultationContext.advisorHelp
          ? `希望优先核对：${consultationContext.advisorHelp}`
          : undefined,
        consultationContext.sevenDayAction
          ? `7 天行动：${consultationContext.sevenDayAction}`
          : undefined,
        consultationContext.next30DayGoal
          ? `未来 30 天目标：${consultationContext.next30DayGoal}`
          : undefined,
        `CET6 ${cet6Labels[profile.cet6Status ?? "UNKNOWN"]}${
          profile.cet6Score === undefined ? "" : `（${profile.cet6Score}）`
        }`,
        `科研：${researchSummary}`,
        `竞赛：${competitionSummary}`,
        `学生倾向：${preferenceLabels[profile.pathPreference ?? "UNDECIDED"]}`,
        `系统建议：${pathLabels[report.pathDecision.path]}`,
        mainRisks.length > 0 ? `主要风险：${mainRisks.join("；")}` : undefined,
        priorityTopics.length > 0
          ? `建议优先沟通：${priorityTopics.join("；")}`
          : undefined,
        profile.dailyStudyHours === undefined
          ? undefined
          : `每日可投入 ${profile.dailyStudyHours} 小时`,
      ]
        .filter(Boolean)
        .join("；")
    : undefined;
  return {
    actionsAlreadyRecommended: report.actionPriorities,
    advisorSummary,
    consultationContext,
    doNotPromise: [
      "不承诺录取结果",
      "不将当前评分解释为录取概率",
      "不引用未经证据验证的院校政策",
    ],
    leadId,
    leadScore,
    missingInformation: report.missingData,
    postgraduateExamScore: report.postgraduateExamScore,
    recommendationScore: report.recommendationScore,
    recommendedConversationTopics,
    recommendedOpening: consultationContext.specificBlocker
      ? `你好，我看到你现在主要卡在“${consultationContext.specificBlocker}”。我们先把这个问题判断清楚，再结合${primaryGoal}确定下一步。`
      : `你好，我看到你本次测评关注${primaryGoal}。可以先一起核对当前画像和最优先的行动，再讨论适合你的路径。`,
    recommendedPath: report.pathDecision.path,
    schoolRecommendations: report.schoolRecommendations,
    studentProfile: profile
      ? {
          cet4Score: profile.cet4Score,
          cet4Status: profile.cet4Status,
          cet6Score: profile.cet6Score,
          cet6Status: profile.cet6Status,
          cohortSize: profile.cohortSize,
          college: profile.college,
          competitionSummary,
          dailyStudyHours: profile.dailyStudyHours,
          grade: profile.grade,
          major: profile.major,
          pathPreference: profile.pathPreference,
          rank: profile.rank,
          rankPercentile: profile.rankPercentile,
          researchSummary,
          riskPreference: profile.riskPreference,
          school: profile.school,
        }
      : undefined,
    studentSummary: report.studentSummary,
    suggestedConversationTopics: recommendedConversationTopics,
    targetCities: report.studentSummary.targetCities,
    targetMajors: report.studentSummary.targetMajors,
    targetUniversities: report.studentSummary.targetUniversities,
    topActionPriorities: report.actionPriorities,
    topGoals,
    topPrograms: report.schoolRecommendations,
    topRisks: report.topRisks,
    version: "lead-handoff-v0.2",
    whyContactNow: [
      ...leadScore.urgencyReasons,
      ...leadScore.reasons.filter(
        (reason) => !leadScore.urgencyReasons.includes(reason)
      ),
    ].slice(0, 5),
  };
}
