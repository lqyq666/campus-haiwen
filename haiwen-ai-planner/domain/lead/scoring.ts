import { clampScore } from "@/domain/scoring/types";
import { hasContact, isContactable } from "./contactability";
import type {
  LeadQualification,
  LeadScore,
  LeadScoringInput,
  LeadStatus,
} from "./models";
import { leadScoringConfig as config } from "./scoring-rules";

export function calculateLeadScore(input: LeadScoringInput): LeadScore {
  const fitReasons: string[] = [];
  const intentReasons: string[] = [];
  const risks = input.report.topRisks.map((risk) => risk.code);
  let fit = 15;
  if (input.report.pathDecision.path === "DUAL_TRACK") {
    fit += 12;
    fitReasons.push("双轨规划需要资源分配建议");
  }
  if (
    input.report.schoolRecommendations.some(
      (item) => item.tier === "STRETCH" || item.riskFlags.length
    )
  ) {
    fit += 12;
    fitReasons.push("存在院校匹配或资格风险");
  }
  if (input.report.missingData.length) {
    fit += 8;
    fitReasons.push("画像或政策信息仍需补全");
  }
  if (["FRESHMAN", "SOPHOMORE", "JUNIOR"].includes(input.profile.grade ?? "")) {
    fit += 8;
    fitReasons.push("仍处于可执行长期规划的阶段");
  }
  const eventTypes = new Set(input.events.map((event) => event.type));
  let intent = 0;
  for (const [type, points] of Object.entries(config.eventPoints)) {
    if (eventTypes.has(type as keyof typeof config.eventPoints)) {
      intent += Math.min(
        points,
        config.eventCaps[type as keyof typeof config.eventCaps]
      );
    }
  }
  if (input.contact && hasContact(input.contact)) {
    intent += 5;
    intentReasons.push("已提供有效联系方式");
  }
  const fitScore = clampScore(Math.min(50, fit));
  const intentScore = clampScore(Math.min(50, intent));
  const total = clampScore(fitScore + intentScore);
  if (eventTypes.size) {
    intentReasons.push(`已记录 ${eventTypes.size} 类主动行为`);
  }
  const { reasons: urgencyReasons, score: urgencyScore } = urgencyFor(
    input.profile.monthsRemaining,
    eventTypes.has("REQUESTED_CONSULTATION")
  );
  const qualification = qualificationFor(
    total,
    input.contact,
    eventTypes.has("REQUESTED_CONSULTATION")
  );
  return {
    calculatedAt: new Date(0).toISOString(),
    fitReasons,
    fitScore,
    intentReasons,
    intentScore,
    priority: priorityFor(urgencyScore),
    qualification,
    reasons: [...fitReasons, ...intentReasons, ...urgencyReasons],
    riskFlags: risks,
    total,
    urgencyReasons,
    urgencyScore,
    version: config.version,
  };
}

export function statusForLead(
  score: LeadScore,
  contact?: LeadScoringInput["contact"]
): LeadStatus {
  if (score.qualification === "HOT" && isContactable(contact)) {
    return "READY_FOR_CONSULTANT";
  }
  if (score.qualification === "QUALIFIED") {
    return "QUALIFIED";
  }
  if (score.qualification === "NURTURE") {
    return "NURTURING";
  }
  return "NEW";
}

function qualificationFor(
  total: number,
  contact: LeadScoringInput["contact"],
  requested: boolean
): LeadQualification {
  if (requested && isContactable(contact)) {
    return "HOT";
  }
  if (total >= config.thresholds.hot && isContactable(contact)) {
    return "HOT";
  }
  if (total >= config.thresholds.qualified) {
    return "QUALIFIED";
  }
  return total >= config.thresholds.nurture ? "NURTURE" : "LOW";
}
function priorityFor(urgencyScore: number) {
  if (urgencyScore >= config.urgencyThresholds.urgent) {
    return "URGENT";
  }
  if (urgencyScore >= config.urgencyThresholds.high) {
    return "HIGH";
  }
  return urgencyScore >= config.urgencyThresholds.normal ? "NORMAL" : "LOW";
}

function urgencyFor(monthsRemaining: number | undefined, requested: boolean) {
  if (requested) {
    return {
      reasons: ["主动请求顾问咨询"],
      score: config.urgency.requestedConsultation,
    };
  }
  if (monthsRemaining === undefined) {
    return { reasons: ["目标时间信息不足"], score: config.urgency.unknown };
  }
  const band = config.urgency.monthsRemaining.find(
    (candidate) => monthsRemaining <= candidate.max
  );
  return band
    ? {
        reasons: [`距离目标节点约 ${monthsRemaining} 个月`],
        score: band.score,
      }
    : { reasons: ["目标时间窗口较长"], score: 10 };
}
