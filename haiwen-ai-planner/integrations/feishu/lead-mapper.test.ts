import { expect, it } from "vitest";
import type {
  Lead,
  LeadContact,
  LeadHandoffContext,
  LeadScore,
} from "@/domain/lead/models";
import {
  FEISHU_EVENT_FIELD_MAP,
  FEISHU_LEAD_FIELD_MAP,
  mapEventToFeishuFields,
  mapLeadToFeishuFields,
} from "./lead-mapper";

it("maps event fields and the human-facing event type to Chinese", () => {
  const fields = mapEventToFeishuFields({
    eventKey: "lead-1:CONTACT_SUBMITTED",
    id: "event-1",
    leadId: "lead-1",
    occurredAt: "2026-09-04T00:00:00.000Z",
    type: "CONTACT_SUBMITTED",
  });

  expect(fields[FEISHU_EVENT_FIELD_MAP.type]).toBe("联系方式已提交");
  expect(fields).toHaveProperty("事件编号");
  expect(fields).toHaveProperty("事件唯一键");
  expect(fields).toHaveProperty("线索编号");
  expect(fields).toHaveProperty("发生时间");
  expect(fields).toHaveProperty("事件详情");
});

it("maps contact consent and lead qualification to centralized Base fields", () => {
  const lead: Lead = {
    createdAt: "2026-01-01",
    id: "lead-1",
    source: "ASSESSMENT",
    status: "QUALIFIED",
    updatedAt: "2026-01-01",
  };
  const contact: LeadContact = {
    consentToContact: true,
    consentVersion: "contact-consent-v0.2",
    contactable: true,
    createdAt: "2026-01-01",
    leadId: lead.id,
    phone: "13800138000",
    updatedAt: "2026-01-01",
    wechat: "wx",
  };
  const score: LeadScore = {
    calculatedAt: "2026-01-01",
    fitReasons: [],
    fitScore: 30,
    intentReasons: [],
    intentScore: 20,
    priority: "HIGH",
    qualification: "QUALIFIED",
    reasons: [],
    riskFlags: [],
    total: 50,
    urgencyReasons: [],
    urgencyScore: 60,
    version: "lead-score-v0.2",
  };
  const handoff: LeadHandoffContext = {
    actionsAlreadyRecommended: [],
    advisorSummary:
      "成都理工大学计算机与网络安全学院，软件工程，大二，排名 15/100。",
    consultationContext: {
      advisorHelp: "候选院校和专业是否匹配",
      attemptedAction: "查过政策或招生信息",
      biggestWorry: "努力方向不对",
      currentConcern: "不会选学校",
      decisionDeadline: "1 个月内",
      requestedReview: true,
      sevenDayAction: "整理目标院校官方要求",
      specificBlocker: "不知道自己的条件能冲到什么层次",
    },
    doNotPromise: [],
    leadId: lead.id,
    leadScore: score,
    missingInformation: [],
    postgraduateExamScore: {} as never,
    recommendationScore: {} as never,
    recommendedConversationTopics: [],
    recommendedOpening: "",
    recommendedPath: "RECOMMENDATION",
    schoolRecommendations: [],
    studentProfile: {
      cet4Score: 510,
      cet4Status: "PASSED",
      cet6Score: 520,
      cet6Status: "PASSED",
      cohortSize: 100,
      college: "计算机与网络安全学院",
      competitionSummary: "无",
      dailyStudyHours: 3,
      grade: "SOPHOMORE",
      major: "软件工程",
      pathPreference: "DUAL_TRACK",
      rank: 15,
      rankPercentile: 15,
      researchSummary: "无",
      riskPreference: "CONSERVATIVE",
      school: "成都理工大学",
    },
    studentSummary: {
      targetCities: [],
      targetMajors: [],
      targetUniversities: [],
    },
    suggestedConversationTopics: [],
    targetCities: [],
    targetMajors: [],
    targetUniversities: [],
    topActionPriorities: [],
    topGoals: [],
    topPrograms: [],
    topRisks: [],
    version: "lead-handoff-v0.2",
    whyContactNow: [],
  };
  const fields = mapLeadToFeishuFields(lead, contact, score, handoff);
  expect(fields[FEISHU_LEAD_FIELD_MAP.phone]).toBe("13800138000");
  expect(fields[FEISHU_LEAD_FIELD_MAP.qq]).toBe("");
  expect(fields[FEISHU_LEAD_FIELD_MAP.consent]).toBe(true);
  expect(fields[FEISHU_LEAD_FIELD_MAP.qualification]).toBe("有效线索");
  expect(fields[FEISHU_LEAD_FIELD_MAP.priority]).toBe("高");
  expect(fields[FEISHU_LEAD_FIELD_MAP.school]).toBe("成都理工大学");
  expect(fields[FEISHU_LEAD_FIELD_MAP.college]).toBe("计算机与网络安全学院");
  expect(fields[FEISHU_LEAD_FIELD_MAP.major]).toBe("软件工程");
  expect(fields[FEISHU_LEAD_FIELD_MAP.ranking]).toBe("15/100");
  expect(fields[FEISHU_LEAD_FIELD_MAP.rank]).toBe("15");
  expect(fields[FEISHU_LEAD_FIELD_MAP.cohortSize]).toBe("100");
  expect(fields[FEISHU_LEAD_FIELD_MAP.rankPercentile]).toBe("15");
  expect(fields[FEISHU_LEAD_FIELD_MAP.studentPreference]).toBe("双轨准备");
  expect(fields[FEISHU_LEAD_FIELD_MAP.cet6]).toBe("已通过（520）");
  expect(fields[FEISHU_LEAD_FIELD_MAP.cet4]).toBe("已通过（510）");
  expect(fields[FEISHU_LEAD_FIELD_MAP.currentConcern]).toBe("不会选学校");
  expect(fields[FEISHU_LEAD_FIELD_MAP.specificBlocker]).toBe(
    "不知道自己的条件能冲到什么层次"
  );
  expect(fields[FEISHU_LEAD_FIELD_MAP.decisionDeadline]).toBe("1 个月内");
  expect(fields[FEISHU_LEAD_FIELD_MAP.advisorHelp]).toBe(
    "候选院校和专业是否匹配"
  );
  expect(fields[FEISHU_LEAD_FIELD_MAP.sevenDayAction]).toBe(
    "整理目标院校官方要求"
  );
  expect(fields[FEISHU_LEAD_FIELD_MAP.dailyStudyHours]).toBe("3 小时/天");
  expect(fields[FEISHU_LEAD_FIELD_MAP.riskPreference]).toBe("偏稳妥");
  expect(fields[FEISHU_LEAD_FIELD_MAP.requestedReview]).toBe("是");
  expect(fields[FEISHU_LEAD_FIELD_MAP.advisorSummary]).toContain(
    "成都理工大学"
  );
  expect(fields[FEISHU_LEAD_FIELD_MAP.salesStatus]).toBe("新线索");
  expect(fields[FEISHU_LEAD_FIELD_MAP.crmSyncStatus]).toBe("待同步");
  expect(fields).not.toHaveProperty("联系方式");
});
