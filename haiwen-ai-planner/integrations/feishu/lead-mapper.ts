import type {
  Lead,
  LeadContact,
  LeadEvent,
  LeadHandoffContext,
  LeadScore,
} from "@/domain/lead/models";

export const FEISHU_LEAD_FIELD_MAP = {
  actionPriorities: "行动优先级",
  advisor: "负责顾问",
  advisorHelp: "希望优先核对",
  advisorSummary: "顾问摘要",
  assessmentId: "测评编号",
  attemptedAction: "已做尝试",
  biggestWorry: "最大顾虑",
  cet4: "英语四级",
  cet6: "英语六级",
  cohortSize: "专业总人数",
  college: "学院",
  competition: "竞赛经历",
  consent: "允许顾问联系",
  createdAt: "创建时间",
  crmSyncStatus: "同步状态",
  currentConcern: "当前核心问题",
  dailyStudyHours: "每日可投入时间",
  decisionDeadline: "判断期限",
  doNotPromise: "顾问注意事项",
  email: "邮箱",
  followUpNotes: "跟进记录",
  grade: "年级",
  leadId: "线索编号",
  major: "本科专业",
  matchSchools: "匹配院校",
  missingInformation: "待补充信息",
  name: "姓名",
  next30DayGoal: "未来 30 天目标",
  path: "推荐路径",
  phone: "手机号",
  priority: "联系优先级",
  qq: "QQ",
  qualification: "线索等级",
  rank: "专业排名",
  ranking: "专业排名概览",
  rankPercentile: "排名百分比",
  recommendedOpening: "建议开场",
  requestedReview: "申请老师复核",
  research: "科研经历",
  riskPreference: "择校策略",
  risks: "主要风险",
  safeSchools: "稳妥院校",
  salesStatus: "销售状态",
  school: "本科学校",
  sevenDayAction: "7 天行动承诺",
  specificBlocker: "具体卡点",
  stretchSchools: "冲刺院校",
  studentPreference: "学生升学倾向",
  suggestedTopics: "建议沟通主题",
  targetCities: "目标城市",
  targetMajors: "目标专业",
  targetUniversities: "目标院校",
  thirtyDayAction: "30 天行动重点",
  updatedAt: "更新时间",
  wechat: "微信",
  whyContactNow: "联系原因",
} as const;

export const FEISHU_MANUAL_LEAD_FIELDS = new Set<string>([
  FEISHU_LEAD_FIELD_MAP.salesStatus,
  FEISHU_LEAD_FIELD_MAP.advisor,
  FEISHU_LEAD_FIELD_MAP.followUpNotes,
]);

export const FEISHU_EVENT_FIELD_MAP = {
  eventId: "事件编号",
  eventKey: "事件唯一键",
  leadId: "线索编号",
  metadata: "事件详情",
  occurredAt: "发生时间",
  type: "事件类型",
} as const;

const eventTypeLabels = {
  AI_REPORT_GENERATED: "智能报告已生成",
  ASSESSMENT_COMPLETED: "测评已完成",
  ASSESSMENT_STARTED: "测评已开始",
  CHAT_MESSAGE_SENT: "咨询消息已发送",
  CHAT_STARTED: "咨询已开始",
  CONTACT_SUBMITTED: "联系方式已提交",
  EVIDENCE_VIEWED: "官方依据已查看",
  REPORT_VIEWED: "报告已查看",
  REQUESTED_CONSULTATION: "已申请老师咨询",
  RETURN_VISIT: "再次访问",
  ROADMAP_VIEWED: "行动计划已查看",
  SCHOOL_RECOMMENDATION_VIEWED: "院校建议已查看",
} as const;

function text(values: readonly string[]) {
  return values.join("、");
}

function englishResult(
  status:
    | "FAILED"
    | "NOT_TAKEN"
    | "PASSED"
    | "TAKEN_UNKNOWN"
    | "UNKNOWN"
    | undefined,
  score: number | undefined
) {
  const label = {
    FAILED: "未通过",
    NOT_TAKEN: "未参加",
    PASSED: "已通过",
    TAKEN_UNKNOWN: "已参加",
    UNKNOWN: "不确定",
  }[status ?? "UNKNOWN"];
  return score === undefined ? label : `${label}（${score}）`;
}

function leadPriority(value: LeadScore["priority"]) {
  return {
    HIGH: "高",
    LOW: "低",
    NORMAL: "普通",
    URGENT: "紧急",
  }[value];
}

function leadQualification(value: LeadScore["qualification"]) {
  return {
    HOT: "高意向",
    LOW: "低意向",
    NURTURE: "待培育",
    QUALIFIED: "有效线索",
  }[value];
}

function pathLabel(value: string | undefined) {
  return (
    {
      DUAL_TRACK: "双轨准备",
      INSUFFICIENT_DATA: "信息不足",
      POSTGRAD_EXAM: "考研",
      RECOMMENDATION: "保研",
      UNDECIDED: "暂未决定",
    }[value ?? ""] ??
    value ??
    ""
  );
}

export function mapLeadToFeishuFields(
  lead: Lead,
  contact: LeadContact | undefined,
  score: LeadScore,
  handoff: LeadHandoffContext
): Record<string, unknown> {
  const programs = (tier: "STRETCH" | "MATCH" | "CONSERVATIVE") =>
    text(
      handoff.schoolRecommendations
        .filter((item) => item.tier === tier)
        .map((item) => item.programId)
    );
  const profile = handoff.studentProfile;
  const consultationContext = handoff.consultationContext ?? {
    requestedReview: false,
  };
  const riskPreference = profile?.riskPreference
    ? {
        AGGRESSIVE: "偏冲刺",
        BALANCED: "梯度搭配",
        CONSERVATIVE: "偏稳妥",
      }[profile.riskPreference]
    : "";
  return {
    [FEISHU_LEAD_FIELD_MAP.actionPriorities]: text(
      handoff.topActionPriorities.map((item) => item.title)
    ),
    [FEISHU_LEAD_FIELD_MAP.advisor]: "",
    [FEISHU_LEAD_FIELD_MAP.advisorSummary]: handoff.advisorSummary ?? "",
    [FEISHU_LEAD_FIELD_MAP.assessmentId]: lead.assessmentId ?? "",
    [FEISHU_LEAD_FIELD_MAP.cet4]: englishResult(
      profile?.cet4Status,
      profile?.cet4Score
    ),
    [FEISHU_LEAD_FIELD_MAP.consent]: contact?.consentToContact ?? false,
    [FEISHU_LEAD_FIELD_MAP.college]: profile?.college ?? "",
    [FEISHU_LEAD_FIELD_MAP.createdAt]: lead.createdAt,
    [FEISHU_LEAD_FIELD_MAP.currentConcern]:
      consultationContext.currentConcern ?? "",
    [FEISHU_LEAD_FIELD_MAP.specificBlocker]:
      consultationContext.specificBlocker ?? "",
    [FEISHU_LEAD_FIELD_MAP.decisionDeadline]:
      consultationContext.decisionDeadline ?? "",
    [FEISHU_LEAD_FIELD_MAP.attemptedAction]:
      consultationContext.attemptedAction ?? "",
    [FEISHU_LEAD_FIELD_MAP.biggestWorry]:
      consultationContext.biggestWorry ?? "",
    [FEISHU_LEAD_FIELD_MAP.advisorHelp]: consultationContext.advisorHelp ?? "",
    [FEISHU_LEAD_FIELD_MAP.sevenDayAction]:
      consultationContext.sevenDayAction ?? "",
    [FEISHU_LEAD_FIELD_MAP.dailyStudyHours]:
      profile?.dailyStudyHours === undefined
        ? ""
        : `${profile.dailyStudyHours} 小时/天`,
    [FEISHU_LEAD_FIELD_MAP.crmSyncStatus]: "待同步",
    [FEISHU_LEAD_FIELD_MAP.cet6]: englishResult(
      profile?.cet6Status,
      profile?.cet6Score
    ),
    [FEISHU_LEAD_FIELD_MAP.email]: contact?.email ?? "",
    [FEISHU_LEAD_FIELD_MAP.grade]: profile?.grade ?? "",
    [FEISHU_LEAD_FIELD_MAP.leadId]: lead.id,
    [FEISHU_LEAD_FIELD_MAP.major]: profile?.major ?? "",
    [FEISHU_LEAD_FIELD_MAP.matchSchools]: programs("MATCH"),
    [FEISHU_LEAD_FIELD_MAP.name]: contact?.name ?? "",
    [FEISHU_LEAD_FIELD_MAP.path]: pathLabel(handoff.recommendedPath),
    [FEISHU_LEAD_FIELD_MAP.phone]: contact?.phone ?? "",
    [FEISHU_LEAD_FIELD_MAP.qq]: contact?.qq ?? "",
    [FEISHU_LEAD_FIELD_MAP.priority]: leadPriority(score.priority),
    [FEISHU_LEAD_FIELD_MAP.qualification]: leadQualification(
      score.qualification
    ),
    [FEISHU_LEAD_FIELD_MAP.rank]: String(profile?.rank ?? ""),
    [FEISHU_LEAD_FIELD_MAP.cohortSize]: String(profile?.cohortSize ?? ""),
    [FEISHU_LEAD_FIELD_MAP.rankPercentile]: String(
      profile?.rankPercentile ?? ""
    ),
    [FEISHU_LEAD_FIELD_MAP.risks]: text(
      handoff.topRisks.slice(0, 3).map((item) => item.message)
    ),
    [FEISHU_LEAD_FIELD_MAP.ranking]: profile?.rank
      ? `${profile.rank}/${profile.cohortSize ?? "?"}`
      : "",
    [FEISHU_LEAD_FIELD_MAP.research]: profile?.researchSummary ?? "",
    [FEISHU_LEAD_FIELD_MAP.competition]: profile?.competitionSummary ?? "",
    [FEISHU_LEAD_FIELD_MAP.requestedReview]: consultationContext.requestedReview
      ? "是"
      : "否",
    [FEISHU_LEAD_FIELD_MAP.riskPreference]: riskPreference,
    [FEISHU_LEAD_FIELD_MAP.safeSchools]: programs("CONSERVATIVE"),
    [FEISHU_LEAD_FIELD_MAP.stretchSchools]: programs("STRETCH"),
    [FEISHU_LEAD_FIELD_MAP.salesStatus]: "新线索",
    [FEISHU_LEAD_FIELD_MAP.followUpNotes]: "",
    [FEISHU_LEAD_FIELD_MAP.school]: profile?.school ?? "",
    [FEISHU_LEAD_FIELD_MAP.studentPreference]: pathLabel(
      profile?.pathPreference
    ),
    [FEISHU_LEAD_FIELD_MAP.suggestedTopics]: text(
      handoff.suggestedConversationTopics
    ),
    [FEISHU_LEAD_FIELD_MAP.recommendedOpening]: handoff.recommendedOpening,
    [FEISHU_LEAD_FIELD_MAP.whyContactNow]: text(handoff.whyContactNow),
    [FEISHU_LEAD_FIELD_MAP.missingInformation]: text(
      handoff.missingInformation
    ),
    [FEISHU_LEAD_FIELD_MAP.doNotPromise]: text(handoff.doNotPromise),
    [FEISHU_LEAD_FIELD_MAP.targetCities]: text(handoff.targetCities),
    [FEISHU_LEAD_FIELD_MAP.targetMajors]: text(handoff.targetMajors),
    [FEISHU_LEAD_FIELD_MAP.targetUniversities]: text(
      handoff.targetUniversities
    ),
    [FEISHU_LEAD_FIELD_MAP.thirtyDayAction]: text(
      handoff.topActionPriorities
        .filter((item) => item.timeWindow === "DAYS_0_30")
        .map((item) => item.action)
    ),
    [FEISHU_LEAD_FIELD_MAP.next30DayGoal]:
      consultationContext.next30DayGoal ?? "",
    [FEISHU_LEAD_FIELD_MAP.updatedAt]: lead.updatedAt,
    [FEISHU_LEAD_FIELD_MAP.wechat]: contact?.wechat ?? "",
  };
}

export function mapEventToFeishuFields(
  event: LeadEvent
): Record<string, unknown> {
  return {
    [FEISHU_EVENT_FIELD_MAP.eventId]: event.id,
    [FEISHU_EVENT_FIELD_MAP.eventKey]: event.eventKey ?? event.id,
    [FEISHU_EVENT_FIELD_MAP.leadId]: event.leadId,
    [FEISHU_EVENT_FIELD_MAP.metadata]: JSON.stringify(event.metadata ?? {}),
    [FEISHU_EVENT_FIELD_MAP.occurredAt]: event.occurredAt,
    [FEISHU_EVENT_FIELD_MAP.type]: eventTypeLabels[event.type],
  };
}
