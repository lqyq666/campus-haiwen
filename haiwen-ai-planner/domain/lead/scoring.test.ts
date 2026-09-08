import { expect, it } from "vitest";
import { createAssessmentResult } from "@/domain/assessment/result";
import { createAssessmentReport } from "@/domain/recommendation/report";
import { parseStudentProfile } from "@/domain/student/schema";
import { canTransitionLeadStatus } from "./lifecycle";
import { calculateLeadScore, statusForLead } from "./scoring";

const profile = parseStudentProfile({
  cet6Score: 520,
  cohortSize: 100,
  dailyStudyHours: 3,
  grade: "SOPHOMORE",
  rank: 10,
  targetMajors: ["计算机"],
});
const assessment = createAssessmentResult(profile);
const report = createAssessmentReport({
  actionPriorities: [],
  admissionYear: 2027,
  assessmentResult: assessment,
  evidence: [],
  profile,
  schoolRecommendations: [],
  sourceDocuments: [],
});
it("caps refresh spam and preserves deterministic score ranges", () => {
  const base = calculateLeadScore({
    events: [
      {
        id: "a",
        leadId: "l",
        occurredAt: "2026-01-01",
        type: "ASSESSMENT_COMPLETED",
      },
    ],
    profile,
    report,
  });
  const spam = calculateLeadScore({
    events: Array.from({ length: 100 }, (_, index) => ({
      id: String(index),
      leadId: "l",
      occurredAt: "2026-01-01",
      type: "REPORT_VIEWED" as const,
    })),
    profile,
    report,
  });
  expect(spam.intentScore).toBe(5);
  expect(
    [base, spam].every((item) => item.total >= 0 && item.total <= 100)
  ).toBe(true);
});
it("requires consent before consultant-ready status", () => {
  const score = calculateLeadScore({
    contact: {
      consentToContact: false,
      consentVersion: "contact-consent-v0.2",
      contactable: false,
      createdAt: "",
      leadId: "l",
      phone: "13800138000",
      updatedAt: "",
    },
    events: [
      { id: "x", leadId: "l", occurredAt: "", type: "REQUESTED_CONSULTATION" },
    ],
    profile,
    report,
  });
  expect(
    statusForLead(score, {
      consentToContact: false,
      consentVersion: "contact-consent-v0.2",
      contactable: false,
      createdAt: "",
      leadId: "l",
      phone: "13800138000",
      updatedAt: "",
    })
  ).not.toBe("READY_FOR_CONSULTANT");
});

it("makes an explicitly consenting consultation request hot and urgent", () => {
  const contact = {
    consentToContact: true,
    consentVersion: "contact-consent-v0.2" as const,
    contactable: true,
    createdAt: "",
    leadId: "l",
    phone: "13800138000",
    updatedAt: "",
  };
  const score = calculateLeadScore({
    contact,
    events: [
      { id: "a", leadId: "l", occurredAt: "", type: "ASSESSMENT_COMPLETED" },
      { id: "b", leadId: "l", occurredAt: "", type: "REPORT_VIEWED" },
      { id: "c", leadId: "l", occurredAt: "", type: "CONTACT_SUBMITTED" },
      { id: "d", leadId: "l", occurredAt: "", type: "REQUESTED_CONSULTATION" },
    ],
    profile,
    report,
  });
  expect(score.qualification).toBe("HOT");
  expect(score.priority).toBe("URGENT");
  expect(score.urgencyScore).toBe(100);
  expect(statusForLead(score, contact)).toBe("READY_FOR_CONSULTANT");
});

it("keeps urgency separate from lead quality", () => {
  const distant = calculateLeadScore({
    events: [],
    profile: parseStudentProfile({
      cohortSize: 100,
      grade: "FRESHMAN",
      monthsRemaining: 24,
      rank: 10,
      targetMajors: ["计算机"],
    }),
    report,
  });
  const imminent = calculateLeadScore({
    events: [],
    profile: parseStudentProfile({
      cohortSize: 100,
      grade: "FRESHMAN",
      monthsRemaining: 2,
      rank: 10,
      targetMajors: ["计算机"],
    }),
    report,
  });
  expect(imminent.total).toBe(distant.total);
  expect(imminent.qualification).toBe(distant.qualification);
  expect(imminent.urgencyScore).toBeGreaterThan(distant.urgencyScore);
  expect(imminent.priority).toBe("HIGH");
});

it("deduplicates identical event types in deterministic scoring", () => {
  const once = calculateLeadScore({
    events: [{ id: "a", leadId: "l", occurredAt: "", type: "REPORT_VIEWED" }],
    profile,
    report,
  });
  const retried = calculateLeadScore({
    events: [
      { id: "a", leadId: "l", occurredAt: "", type: "REPORT_VIEWED" },
      { id: "b", leadId: "l", occurredAt: "", type: "REPORT_VIEWED" },
    ],
    profile,
    report,
  });
  expect(retried).toEqual(once);
});

it("allows only typed lifecycle transitions", () => {
  expect(canTransitionLeadStatus("NEW", "NURTURING")).toBe(true);
  expect(canTransitionLeadStatus("CONVERTED", "NURTURING")).toBe(false);
});
