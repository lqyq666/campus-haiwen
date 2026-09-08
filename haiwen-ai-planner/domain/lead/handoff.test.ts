import { expect, it } from "vitest";
import { createAssessmentResult } from "@/domain/assessment/result";
import { createAssessmentReport } from "@/domain/recommendation/report";
import { parseStudentProfile } from "@/domain/student/schema";
import { createLeadHandoffContext } from "./handoff";
import { calculateLeadScore } from "./scoring";

it("creates a structured and deterministic consultant handoff", () => {
  const profile = parseStudentProfile({
    cohortSize: 100,
    college: "计算机与网络安全学院",
    dailyStudyHours: 3,
    grade: "SOPHOMORE",
    major: "软件工程",
    pathPreference: "DUAL_TRACK",
    rank: 20,
    school: "成都理工大学",
    targetCities: ["上海"],
    targetMajors: ["计算机"],
  });
  const report = createAssessmentReport({
    actionPriorities: [],
    admissionYear: 2028,
    assessmentResult: createAssessmentResult(profile),
    evidence: [],
    profile,
    schoolRecommendations: [],
    sourceDocuments: [],
  });
  const score = calculateLeadScore({ events: [], profile, report });
  const handoff = createLeadHandoffContext("lead-1", report, score, profile, {
    currentConcern: "不会选学校",
    requestedReview: true,
    specificBlocker: "不知道自己的条件能冲到什么层次",
  });

  expect(handoff.version).toBe("lead-handoff-v0.2");
  expect(handoff.topGoals).toContain("目标专业：计算机");
  expect(handoff.recommendedOpening).toContain("计算机");
  expect(handoff.recommendedOpening).toContain(
    "不知道自己的条件能冲到什么层次"
  );
  expect(handoff.doNotPromise).toContain("不承诺录取结果");
  expect(handoff.missingInformation).toEqual(report.missingData);
  expect(handoff.studentProfile?.college).toBe("计算机与网络安全学院");
  expect(handoff.advisorSummary).toContain("成都理工大学");
  expect(handoff.advisorSummary).toContain("20/100");
  expect(handoff.consultationContext).toEqual({
    currentConcern: "不会选学校",
    requestedReview: true,
    specificBlocker: "不知道自己的条件能冲到什么层次",
  });
});
