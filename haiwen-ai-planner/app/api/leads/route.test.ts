import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssessmentResult } from "@/domain/assessment/result";
import { createAssessmentReport } from "@/domain/recommendation/report";
import { parseStudentProfile } from "@/domain/student/schema";

const runtime = vi.hoisted(() => ({
  afterTasks: [] as Array<() => unknown>,
  analytics: { ingest: vi.fn() },
  crm: {
    addLeadEvent: vi.fn(),
    createLead: vi.fn(),
    createOrUpdateHandoff: vi.fn(),
    getLatestScore: vi.fn(),
    getLead: vi.fn(),
    listEvents: vi.fn(),
    updateLead: vi.fn(),
    upsertContact: vi.fn(),
    upsertLeadScore: vi.fn(),
  },
}));

const feishu = vi.hoisted(() => ({ syncRuntimeLead: vi.fn() }));

vi.mock("next/server", () => ({
  after: (task: () => unknown) => runtime.afterTasks.push(task),
}));

vi.mock("@/integrations/feishu", () => ({
  syncRuntimeLead: feishu.syncRuntimeLead,
}));

const { crm } = runtime;

vi.mock("@/lib/repositories/school-data", () => ({
  getRuntimeSchoolDataRepositories: () => ({
    analyticsEventRepository: runtime.analytics,
    leadRepository: crm,
  }),
}));

import { POST } from "./route";

const profile = parseStudentProfile({
  cohortSize: 100,
  grade: "SOPHOMORE",
  rank: 10,
  targetMajors: ["计算机"],
});
const report = createAssessmentReport({
  actionPriorities: [],
  admissionYear: 2027,
  assessmentResult: createAssessmentResult(profile),
  evidence: [],
  profile,
  schoolRecommendations: [],
  sourceDocuments: [],
});

function request(contact: unknown, requestConsultation = false) {
  return new Request("http://localhost/api/leads", {
    body: JSON.stringify({
      advisorContext: {
        advisorHelp: "候选院校和专业是否匹配",
        attemptedAction: "查过政策或招生信息",
        biggestWorry: "努力方向不对",
        currentConcern: "不会选学校",
        decisionDeadline: "1 个月内",
        sevenDayAction: "整理目标院校官方要求",
        specificBlocker: "不知道自己的条件能冲到什么层次",
      },
      assessmentId: "assessment-api-test",
      contact,
      profile,
      report,
      requestConsultation,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.afterTasks.length = 0;
    feishu.syncRuntimeLead.mockResolvedValue(undefined);
    crm.createLead.mockImplementation(async (lead: { id: string }) => lead);
    crm.listEvents.mockResolvedValue([
      {
        id: "1",
        leadId: "lead-assessment-api-test",
        occurredAt: "",
        type: "ASSESSMENT_COMPLETED",
      },
      {
        id: "2",
        leadId: "lead-assessment-api-test",
        occurredAt: "",
        type: "REPORT_VIEWED",
      },
      {
        id: "3",
        leadId: "lead-assessment-api-test",
        occurredAt: "",
        type: "CONTACT_SUBMITTED",
      },
    ]);
    runtime.analytics.ingest.mockResolvedValue(true);
  });

  it("returns after durable persistence without waiting for Feishu", async () => {
    feishu.syncRuntimeLead.mockImplementation(
      () =>
        new Promise(() => {
          // Simulate a CRM request that never settles.
        })
    );

    const response = await Promise.race([
      POST(request({ consentToContact: true, phone: "13800138000" })),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 100)
      ),
    ]);

    expect(response).not.toBe("timeout");
    expect(runtime.afterTasks).toHaveLength(1);
  });

  it("captures a valid contact and stores the funnel events", async () => {
    const response = await POST(
      request({ consentToContact: true, phone: "13800138000" })
    );
    expect(response.status).toBe(200);
    expect(crm.addLeadEvent).toHaveBeenCalledTimes(3);
    expect(crm.upsertLeadScore).toHaveBeenCalledOnce();
    expect(crm.createOrUpdateHandoff).toHaveBeenCalledOnce();
    expect(crm.createOrUpdateHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        consultationContext: {
          advisorHelp: "候选院校和专业是否匹配",
          attemptedAction: "查过政策或招生信息",
          biggestWorry: "努力方向不对",
          currentConcern: "不会选学校",
          decisionDeadline: "1 个月内",
          requestedReview: false,
          sevenDayAction: "整理目标院校官方要求",
          specificBlocker: "不知道自己的条件能冲到什么层次",
        },
      })
    );
    expect(runtime.analytics.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAD_SUBMITTED" })
    );
    expect(runtime.analytics.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CONSENT_GRANTED" })
    );
  });

  it("rejects invalid and missing contact methods", async () => {
    expect(
      (await POST(request({ consentToContact: true, phone: "bad" }))).status
    ).toBe(400);
    expect((await POST(request({ consentToContact: true }))).status).toBe(400);
  });

  it("persists a non-contactable lead when consent is absent", async () => {
    const response = await POST(
      request({ consentToContact: false, phone: "13800138000" })
    );
    expect(response.status).toBe(200);
    expect(crm.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ consentToContact: false, contactable: false })
    );
    expect(runtime.analytics.ingest).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CONSENT_GRANTED" })
    );
  });

  it("records a consultation request as a separate idempotent event", async () => {
    crm.listEvents.mockResolvedValue([
      {
        id: "1",
        leadId: "lead-assessment-api-test",
        occurredAt: "",
        type: "REQUESTED_CONSULTATION",
      },
    ]);
    const response = await POST(
      request({ consentToContact: true, wechat: "haiwen_test" }, true)
    );
    expect(response.status).toBe(200);
    expect(crm.addLeadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "lead-assessment-api-test:REQUESTED_CONSULTATION",
      })
    );
  });
});
