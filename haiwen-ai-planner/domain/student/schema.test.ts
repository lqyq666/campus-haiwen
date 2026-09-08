import { describe, expect, it } from "vitest";
import { parseStudentProfile, studentProfileSchema } from "./schema";

describe("studentProfileSchema", () => {
  it("trims strings, defaults arrays, and calculates rank percentile", () => {
    const profile = parseStudentProfile({
      cohortSize: 80,
      college: "  计算机与网络安全学院  ",
      grade: "SOPHOMORE",
      rank: 4,
      undergraduateMajor: "  计算机  ",
    });
    expect(profile.rankPercentile).toBe(5);
    expect(profile.college).toBe("计算机与网络安全学院");
    expect(profile.undergraduateMajor).toBe("计算机");
    expect(profile.researchExperiences).toEqual([]);
    expect(profile.targetUniversities).toEqual([]);
  });

  it("rejects invalid ranking and numeric ranges", () => {
    expect(
      studentProfileSchema.safeParse({ cohortSize: 10, rank: 11 }).success
    ).toBe(false);
    expect(studentProfileSchema.safeParse({ cet6Score: 711 }).success).toBe(
      false
    );
    expect(
      studentProfileSchema.safeParse({ dailyStudyHours: 25 }).success
    ).toBe(false);
  });

  it("keeps an unknown CET6 result distinct from a zero score", () => {
    const unknown = parseStudentProfile({ cet6Status: "TAKEN_UNKNOWN" });
    expect(unknown.cet6Status).toBe("TAKEN_UNKNOWN");
    expect(unknown.cet6Score).toBeUndefined();

    const legacy = parseStudentProfile({ cet6Score: 520 });
    expect(legacy.cet6Status).toBe("PASSED");

    expect(
      studentProfileSchema.safeParse({
        cet6Score: 520,
        cet6Status: "NOT_TAKEN",
      }).success
    ).toBe(false);
  });

  it("parses the additive v0.2 profile without changing legacy fields", () => {
    const profile = parseStudentProfile({
      currentStage: "SUMMER_PREPARATION",
      englishLearningStatus: "PREPARING_CET6",
      englishTarget: "CET6 500",
      familyConstraint: "需兼顾家庭安排",
      financialConstraint: "BUDGET_SENSITIVE",
      graduationYear: 2028,
      ieltsScore: 7,
      major: "软件工程",
      otherConstraints: ["每周实验室值班"],
      pathPreference: "DUAL_TRACK",
      projects: [{ name: "课程平台", relevanceToTarget: "HIGH" }],
      rankingTrend: "IMPROVING",
      researchExperiences: [
        {
          description: "负责实验与复现",
          direction: "机器学习",
          durationMonths: 8,
          id: "research-1",
          isRepresentative: true,
          outputDescription: "校内结题",
          outputLevel: "UNIVERSITY",
          outputType: "PROJECT_REPORT",
          relevanceToTarget: "HIGH",
          role: "CORE",
          title: "时序预测",
        },
      ],
      school: "示例大学",
      schoolCode: "10000",
      schoolTier: "DOUBLE_FIRST_CLASS",
      targetAdmissionYear: 2028,
      targetMajors: ["计算机科学与技术"],
      targetProgramTypes: ["ACADEMIC_MASTER"],
      targetSchoolLevels: ["DOUBLE_FIRST_CLASS"],
      timeContext: {
        currentDate: "2026-08-30",
        currentStage: "SUMMER_PREPARATION",
        monthsRemaining: 18,
        targetAdmissionYear: 2028,
      },
      toeflScore: 98,
      weeklyAvailableHours: 28,
      willingToRelocate: true,
    });

    expect(profile.school).toBe("示例大学");
    expect(profile.undergraduateUniversity).toBe("示例大学");
    expect(profile.major).toBe("软件工程");
    expect(profile.undergraduateMajor).toBe("软件工程");
    expect(profile.researchExperiences[0]?.outputType).toBe("PROJECT_REPORT");
    expect(profile.projects[0]?.name).toBe("课程平台");
    expect(profile.timeContext?.monthsRemaining).toBe(18);
  });

  it("accepts ranking as an alias and rejects conflicting ranks", () => {
    const profile = parseStudentProfile({ cohortSize: 200, ranking: 20 });
    expect(profile.rank).toBe(20);
    expect(profile.ranking).toBe(20);
    expect(profile.rankPercentile).toBe(10);

    expect(
      studentProfileSchema.safeParse({
        cohortSize: 200,
        rank: 10,
        ranking: 20,
      }).success
    ).toBe(false);
  });
});
