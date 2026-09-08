import type {
  LeadContact,
  LeadHandoffContext,
  LeadScore,
} from "@/domain/lead/models";

export function createConsultantNotification(
  contact: LeadContact,
  handoff: LeadHandoffContext,
  score: LeadScore,
  requestedConsultation: boolean
): string {
  const consultationContext = handoff.consultationContext ?? {
    requestedReview: false,
  };
  return [
    "🔥 高意向升学规划线索",
    `学生：${contact.name ?? "未填写"}`,
    `路线：${handoff.recommendedPath}`,
    `Lead Score：${score.total}（${score.qualification} / ${score.priority}）`,
    `当前核心问题：${consultationContext.currentConcern ?? "待补充"}`,
    `具体卡点：${consultationContext.specificBlocker ?? "待补充"}`,
    `希望优先核对：${consultationContext.advisorHelp ?? "待补充"}`,
    `判断期限：${consultationContext.decisionDeadline ?? "待补充"}`,
    `7 天行动：${consultationContext.sevenDayAction ?? "待补充"}`,
    `主要问题：${
      handoff.topRisks
        .map((risk) => risk.message)
        .slice(0, 3)
        .join("；") || "待顾问复核"
    }`,
    `目标：${handoff.targetUniversities.concat(handoff.targetCities, handoff.targetMajors).join("、") || "未填写"}`,
    `建议第一沟通主题：${handoff.suggestedConversationTopics[0] ?? "升学路径与当前计划"}`,
    `联系方式：${contact.phone ?? contact.wechat ?? contact.qq ?? contact.email ?? "未填写"}`,
    `主动申请咨询：${requestedConsultation ? "是" : "否"}`,
  ].join("\n");
}
