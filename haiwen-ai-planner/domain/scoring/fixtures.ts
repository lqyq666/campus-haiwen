import { parseStudentProfile } from "../student/schema";

export const strongSophomore = parseStudentProfile({
  cet6Score: 560,
  cohortSize: 100,
  competitionExperiences: [
    { award: "一等奖", level: "NATIONAL", name: "学科竞赛" },
  ],
  dailyStudyHours: 4,
  grade: "SOPHOMORE",
  papers: [
    {
      authorship: "FIRST",
      status: "PUBLISHED",
      title: "研究论文",
    },
  ],
  rank: 5,
  researchExperiences: [
    {
      durationMonths: 12,
      output: "研究报告",
      role: "LEAD",
      title: "科研项目",
    },
  ],
  targetMajors: ["计算机"],
  targetUniversities: ["目标大学"],
});

export const weakJunior = parseStudentProfile({
  cet4Score: 450,
  cohortSize: 100,
  dailyStudyHours: 4,
  grade: "JUNIOR",
  rank: 40,
  targetCities: ["北京"],
  targetMajors: ["计算机"],
  targetUniversities: ["目标大学"],
});

export const dualTrackSophomore = parseStudentProfile({
  cet4Score: 520,
  cohortSize: 100,
  competitionExperiences: [
    { award: "二等奖", level: "PROVINCIAL", name: "学科竞赛" },
  ],
  dailyStudyHours: 3,
  grade: "SOPHOMORE",
  rank: 15,
  targetMajors: ["电子信息"],
  targetUniversities: ["目标大学"],
});

export const incompleteProfile = parseStudentProfile({
  dailyStudyHours: 2,
});

export const boundaryProfile = parseStudentProfile({
  cet6Score: 520,
  cohortSize: 100,
  dailyStudyHours: 2,
  grade: "JUNIOR",
  rank: 10,
});

export const scoringFixtures = {
  boundaryProfile,
  dualTrackSophomore,
  incompleteProfile,
  strongSophomore,
  weakJunior,
};
