import type { CalibrationCase } from "./models";

export function blindCaseMarkdown(caseItem: CalibrationCase) {
  const { profile } = caseItem;
  return `# Case: ${caseItem.caseId}\n\n## 学生画像（盲评材料）\n\n- 年级：${profile.grade ?? "未提供"}\n- 本科院校背景：${profile.undergraduateUniversity ?? "未提供"}\n- 本科专业：${profile.undergraduateMajor ?? "未提供"}\n- 排名 / 人数：${profile.rank && profile.cohortSize ? `${profile.rank} / ${profile.cohortSize}` : "未提供"}\n- GPA：${profile.gpa ?? "未提供"}\n- 英语：CET4 ${profile.cet4Score ?? "未提供"}；CET6 ${profile.cet6Score ?? "未提供"}\n- 科研：${profile.researchExperiences.length ? `${profile.researchExperiences.length} 项` : "未提供"}\n- 竞赛：${profile.competitionExperiences.length ? `${profile.competitionExperiences.length} 项` : "未提供"}\n- 论文：${profile.papers.length ? `${profile.papers.length} 项` : "未提供"}\n- 实习：${profile.internships.length ? `${profile.internships.length} 项` : "未提供"}\n- 目标城市：${profile.targetCities.join("、") || "未提供"}\n- 目标专业：${profile.targetMajors.join("、") || "未提供"}\n- 目标学校：${profile.targetUniversities.join("、") || "未提供"}\n- 风险偏好：${profile.riskPreference ?? "未提供"}\n- 每日学习时间：${profile.dailyStudyHours ?? "未提供"}\n\n## 信息缺失项\n\n${
    missing(profile)
      .map((item) => `- ${item}`)
      .join("\n") || "- 无明显缺失"
  }\n\n> 请独立填写 review-form.md。此材料不包含系统路径、系统分数、院校层级、风险、行动建议或 AI 解读。\n`;
}
function missing(profile: CalibrationCase["profile"]) {
  const items: string[] = [];
  if (!profile.rank || !profile.cohortSize) {
    items.push("排名或专业人数");
  }
  if (!profile.cet4Score && !profile.cet6Score) {
    items.push("英语成绩");
  }
  if (
    !profile.targetCities.length &&
    !profile.targetMajors.length &&
    !profile.targetUniversities.length
  ) {
    items.push("升学目标");
  }
  if (!profile.grade) {
    items.push("年级");
  }
  return items;
}
export const reviewForm =
  "# 专家独立评审表\n\n评审角色：__________  评审日期：__________\n\n请只根据盲评案例独立判断；这不是对专家的考核。无法判断时选择“信息不足”，不要猜测。\n\n1. 推荐路径：□ 保研为主 □ 考研为主 □ 考研保研双轨 □ 信息不足\n2. 保研竞争力合理区间：最低 ____；最高 ____；□ 无法判断\n3. 考研准备度合理区间：最低 ____；最高 ____；□ 无法判断\n4. 最重要风险（最多 5）：□ 排名 □ 英语 □ 科研 □ 竞赛 □ 目标选择 □ 时间窗口 □ 政策资格 □ 专业课基础 □ 数学基础 □ 学习投入 □ 信息不完整 □ 其他____\n5. 院校判断：冲刺 / 匹配 / 稳妥 / 不应推荐 / 信息不足\n6. 未来 90 天动作（按 1–5 排序）：提高专业排名、提升英语、补科研、补竞赛、明确目标学校/专业、开始考研复习、补数学/专业课基础、核验政策、其他。\n7. 简短备注：________________________________________________\n";
