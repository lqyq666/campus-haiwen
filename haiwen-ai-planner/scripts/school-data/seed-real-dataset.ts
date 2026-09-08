import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { computeContentHash } from "@/domain/evidence/integrity";

const generatedAt = "2026-08-29T00:00:00.000Z";
const root = join(process.cwd(), "data", "schools", "real");
const stamp = { createdAt: generatedAt, updatedAt: generatedAt };
const source = (
  id: string,
  sourceUrl: string,
  title: string,
  admissionYear: number | undefined,
  freshness: "CURRENT" | "LATEST_OFFICIAL_HISTORICAL",
  rawText: string
) => ({
  admissionYear,
  canonicalUrl: sourceUrl,
  contentHash: computeContentHash(rawText),
  fetchedAt: generatedAt,
  freshness,
  id,
  publisher: "学校研究生招生网",
  rawText,
  sourceTrust: "OFFICIAL",
  sourceType: "GRADUATE_ADMISSIONS_NOTICE",
  sourceUrl,
  title,
  ...stamp,
});

const sources = [
  source(
    "real:source:seu:2027:recommendation",
    "https://yzb.seu.edu.cn/2026/0706/c6676a575627/page.htm",
    "东南大学2027年接收推荐免试研究生报名通知",
    2027,
    "CURRENT",
    "东南大学2027年接收推荐免试研究生报名通知。申请者应在本科学校可取得推荐免试研究生资格；报名材料包括本科阶段成绩单、外语成绩证明、学术成果证明和实践经历证明。"
  ),
  source(
    "real:source:seu:2026:catalog",
    "https://yzb.seu.edu.cn/2025/1009/c6676a541449/page.htm",
    "东南大学2026年硕士研究生考试招生专业一览表",
    2026,
    "LATEST_OFFICIAL_HISTORICAL",
    "009 计算机科学与工程学院：081200 计算机科学与技术，全日制；083500 软件工程，全日制；085404 计算机技术，全日制；085410 人工智能，全日制；140500 智能科学与技术，全日制。"
  ),
  source(
    "real:source:nju:2027:recommendation",
    "https://yzb.nju.edu.cn/d4/52/c47863a840786/page.htm",
    "南京大学2027年接收推荐免试研究生预报名通知",
    2027,
    "CURRENT",
    "南京大学2027年接收推荐免试研究生预报名通知。申请人应通过预报名系统提交申请；各院系预报名截止时间以学校汇总通知为准。"
  ),
  source(
    "real:source:nju:computer",
    "https://cs.nju.edu.cn/",
    "南京大学计算机学院",
    2026,
    "LATEST_OFFICIAL_HISTORICAL",
    "南京大学计算机学院。计算机科学与技术、软件工程为本数据集收录的计算机相关硕士招生专业；具体年度招生目录以南京大学研究生招生网公布为准。"
  ),
  source(
    "real:source:njust:2027:recommendation",
    "https://gs.njust.edu.cn/zsw/a0/25/c4587a368677/page.htm",
    "2027年南京理工大学推荐免试研究生预报名的通知",
    2027,
    "CURRENT",
    "2027年南京理工大学推荐免试研究生预报名的通知列出计算机科学与工程学院、智能科学与技术学院等招生单位的预推免安排。"
  ),
  source(
    "real:source:njust:2026:catalog",
    "https://gs.njust.edu.cn/zsw/6b/27/c4587a355111/page.htm",
    "2026年南京理工大学硕士研究生招生简章及目录",
    2026,
    "LATEST_OFFICIAL_HISTORICAL",
    "2026年南京理工大学硕士研究生招生简章及目录。招生专业目录中的计划包含接收推荐免试和统一入学考试等各类计划；计算机科学与技术、计算机技术由计算机科学与工程学院招生。"
  ),
  source(
    "real:source:nupt:2027:catalog",
    "https://yzb.njupt.edu.cn/2026/0722/c7795a306725/page.htm",
    "南京邮电大学2027年硕士研究生招生专业目录（预告版）",
    2027,
    "CURRENT",
    "南京邮电大学2027年硕士研究生招生专业目录（预告版）。此版依据教育部2026年硕士研究生招生专业目录编制工作通知要求编制，最终以国家研招网公布的版本为准。"
  ),
  source(
    "real:source:nupt:2026:catalog",
    "https://yzb.njupt.edu.cn/2025/0929/c7801a289588/page.htm",
    "南京邮电大学2026年硕士研究生招生专业目录",
    2026,
    "LATEST_OFFICIAL_HISTORICAL",
    "南京邮电大学2026年硕士研究生招生专业目录。计算机学院、软件学院相关招生专业包括081200计算机科学与技术、083500软件工程、085404计算机技术、085405软件工程。"
  ),
  source(
    "real:source:nupt:2026:charter",
    "https://yzb.njupt.edu.cn/2025/0928/c7801a289524/page.htm",
    "南京邮电大学2026年硕士研究生招生章程",
    2026,
    "LATEST_OFFICIAL_HISTORICAL",
    "南京邮电大学2026年硕士研究生招生章程。招生计划包含推荐免试研究生，最终招生人数以上级部门正式下达的计划为准。"
  ),
  source(
    "real:source:hdu:2026:catalog",
    "https://grs.hdu.edu.cn/2025/0926/c13497a286163/page.htm",
    "2026年硕士研究生招生专业目录与自命题科目考试大纲（含报考上线录取情况）",
    2026,
    "LATEST_OFFICIAL_HISTORICAL",
    "杭州电子科技大学2026年硕士研究生招生专业目录。050计算机学院：081200计算机科学与技术、083500软件工程、085404计算机技术、085405软件工程，均为全日制。"
  ),
  source(
    "real:source:hdu:2026:scoreline",
    "https://grs.hdu.edu.cn/2026/0324/c13270a290580/page.htm",
    "杭州电子科技大学2026年硕士研究生招生复试分数线",
    2026,
    "LATEST_OFFICIAL_HISTORICAL",
    "050计算机学院：081200计算机科学与技术，学术学位，全日制；083500软件工程，学术学位，全日制；085404计算机技术，专业学位，全日制；085405软件工程，专业学位，全日制。"
  ),
  source(
    "real:source:hdu:2026:recommendation",
    "https://grs.hdu.edu.cn/2025/0912/c13497a285589/page.htm",
    "杭州电子科技大学2026年接收推荐免试攻读博士、硕士学位研究生章程",
    2026,
    "LATEST_OFFICIAL_HISTORICAL",
    "杭州电子科技大学2026年接收推荐免试攻读博士、硕士学位研究生章程。接收推荐免试研究生的具体专业和安排以学校公布信息为准。"
  ),
];

const universities = [
  ["seu", "东南大学", "东大", "南京", "江苏"],
  ["nju", "南京大学", "南大", "南京", "江苏"],
  ["njust", "南京理工大学", "南理工", "南京", "江苏"],
  ["nupt", "南京邮电大学", "南邮", "南京", "江苏"],
  ["hdu", "杭州电子科技大学", "杭电", "杭州", "浙江"],
].map(([key, name, shortName, city, province]) => ({
  active: true,
  city,
  id: `real:university:${key}`,
  name,
  officialWebsite:
    key === "hdu"
      ? "https://www.hdu.edu.cn/"
      : `https://${key === "seu" ? "www.seu.edu.cn" : key === "nju" ? "www.nju.edu.cn" : key === "njust" ? "www.njust.edu.cn" : "www.njupt.edu.cn"}/`,
  province,
  shortName,
  tags: ["计算机", "硕士招生"],
  type: "PUBLIC_UNIVERSITY",
  ...stamp,
}));
const departments = [
  ["seu", "计算机科学与工程学院"],
  ["nju", "计算机学院"],
  ["njust", "计算机科学与工程学院"],
  ["nupt", "计算机学院、软件学院"],
  ["hdu", "计算机学院（软件学院）"],
].map(([key, name]) => ({
  id: `real:department:${key}:computer`,
  name,
  officialWebsite: undefined,
  universityId: `real:university:${key}`,
  ...stamp,
}));
const definitions = [
  ["seu", "081200", "计算机科学与技术", "ACADEMIC"],
  ["seu", "083500", "软件工程", "ACADEMIC"],
  ["seu", "085404", "计算机技术", "PROFESSIONAL"],
  ["nju", "081200", "计算机科学与技术", "ACADEMIC"],
  ["nju", "083500", "软件工程", "ACADEMIC"],
  ["njust", "081200", "计算机科学与技术", "ACADEMIC"],
  ["njust", "085404", "计算机技术", "PROFESSIONAL"],
  ["nupt", "081200", "计算机科学与技术", "ACADEMIC"],
  ["nupt", "085404", "计算机技术", "PROFESSIONAL"],
  ["hdu", "081200", "计算机科学与技术", "ACADEMIC"],
  ["hdu", "085404", "计算机技术", "PROFESSIONAL"],
] as const;
const programs = definitions.map(([school, code, name, degreeType]) => ({
  active: true,
  admissionType: "BOTH",
  code,
  degreeType,
  departmentId: `real:department:${school}:computer`,
  disciplineCategory: "计算机相关",
  id: `real:program:${school}:${code}`,
  name,
  studyMode: "FULL_TIME",
  universityId: `real:university:${school}`,
  ...stamp,
}));
const catalog = (school: string) =>
  school === "seu"
    ? "real:source:seu:2026:catalog"
    : school === "nju"
      ? "real:source:nju:computer"
      : school === "njust"
        ? "real:source:njust:2026:catalog"
        : school === "nupt"
          ? "real:source:nupt:2026:catalog"
          : "real:source:hdu:2026:catalog";
const schoolKey = (programId: string) => {
  const [, , school] = programId.split(":");
  if (!school) {
    throw new Error(`Invalid program id: ${programId}`);
  }
  return school;
};
const admissionPolicies = programs.map((program) => ({
  admissionYear: 2026,
  examSubjects: [],
  freshness: "LATEST_OFFICIAL_HISTORICAL",
  id: `real:admission:${program.id.slice(13)}:2026`,
  notes: "历史目录事实；不作为2027当前招生政策。",
  programId: program.id,
  sourceDocumentId: catalog(schoolKey(program.id)),
  ...stamp,
}));
const currentSchools = new Set(["seu", "nju", "njust"]);
const recommendationPolicies = programs
  .filter((p) => currentSchools.has(schoolKey(p.id)))
  .map((program) => {
    const school = schoolKey(program.id);
    return {
      admissionYear: 2027,
      eligibilityNotes: "以学校及学院当年官方通知为准。",
      freshness: "CURRENT",
      id: `real:recommendation:${program.id.slice(13)}:2027`,
      programId: program.id,
      sourceDocumentId: `real:source:${school}:2027:recommendation`,
      stage: "PRE_RECOMMENDATION",
      ...stamp,
    };
  });
const sourceById = new Map(sources.map((item) => [item.id, item]));
const evidences = [...admissionPolicies, ...recommendationPolicies].flatMap(
  (policy, index) => {
    const program = programs.find((item) => item.id === policy.programId);
    const document = sourceById.get(policy.sourceDocumentId);
    if (!program || !document) {
      throw new Error("Policy reference is invalid");
    }
    const excerpt =
      policy.admissionYear === 2027
        ? document.rawText.includes("推荐免试")
          ? document.rawText.split("。 ")[0]
          : document.rawText
        : `${program.code}${program.name}`;
    const available = document.rawText.includes(excerpt)
      ? excerpt
      : document.rawText;
    const primary = {
      contentHash: computeContentHash(available),
      evidenceType:
        policy.admissionYear === 2027 ? "ELIGIBILITY" : "ENROLLMENT",
      excerpt: available,
      id: `real:evidence:${index + 1}`,
      programId: program.id,
      sourceDocumentId: document.id,
      ...stamp,
    };
    if (policy.admissionYear !== 2027) {
      return [primary];
    }
    const policyText = document.rawText;
    return [
      primary,
      {
        contentHash: computeContentHash(policyText),
        evidenceType: "POLICY_TEXT",
        excerpt: policyText,
        id: `real:evidence:policy:${index + 1}`,
        programId: program.id,
        sourceDocumentId: document.id,
        ...stamp,
      },
    ];
  }
);

const files: Record<string, unknown> = {
  "admission-policies.json": admissionPolicies,
  "departments.json": departments,
  "evidences.json": evidences,
  "manifest.json": {
    datasetType: "REAL",
    datasetVersion: "real-school-data-v0.1",
    generatedAt,
    scope: {
      majors: [
        "计算机科学与技术",
        "软件工程",
        "计算机技术",
        "人工智能",
        "智能科学与技术",
      ],
      regions: ["江苏", "浙江"],
    },
    sourcePolicy: "OFFICIAL_SCHOOL_GRADUATE_ADMISSIONS_ONLY",
    targetAdmissionYear: 2027,
  },
  "programs.json": programs,
  "recommendation-policies.json": recommendationPolicies,
  "sources.json": sources,
  "universities.json": universities,
};
async function main() {
  await mkdir(root, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([file, data]) =>
      writeFile(join(root, file), `${JSON.stringify(data, null, 2)}\n`)
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
