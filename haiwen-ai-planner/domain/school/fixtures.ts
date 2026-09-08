import {
  computeContentHash,
  normalizeEvidenceText,
} from "../evidence/integrity";
import type { Evidence, SourceDocument } from "../evidence/models";
import type {
  AdmissionPolicy,
  Department,
  Program,
  RecommendationPolicy,
  University,
} from "./models";

const now = "2026-08-29T00:00:00.000Z";

export const fixtureUniversities: University[] = [
  university("uni-east", "华东测试大学", "上海"),
  university("uni-river", "江南测试大学", "杭州"),
  university("uni-lake", "湖畔测试大学", "南京"),
];

export const fixtureDepartments: Department[] = [
  department("dept-east-cs", "uni-east", "计算机学院"),
  department("dept-east-ee", "uni-east", "电子信息学院"),
  department("dept-river-cs", "uni-river", "计算与数据学院"),
  department("dept-lake-engineering", "uni-lake", "工程学院"),
];

export const fixturePrograms: Program[] = [
  program(
    "prog-east-cs",
    "uni-east",
    "dept-east-cs",
    "计算机科学与技术",
    "BOTH"
  ),
  program("prog-east-se", "uni-east", "dept-east-cs", "软件工程", "EXAM"),
  program("prog-east-ai", "uni-east", "dept-east-cs", "人工智能", "BOTH"),
  program("prog-east-ee", "uni-east", "dept-east-ee", "电子信息", "EXAM"),
  program(
    "prog-river-cs",
    "uni-river",
    "dept-river-cs",
    "计算机科学与技术",
    "BOTH"
  ),
  program("prog-river-data", "uni-river", "dept-river-cs", "数据科学", "EXAM"),
  program(
    "prog-river-ai",
    "uni-river",
    "dept-river-cs",
    "人工智能",
    "RECOMMENDATION"
  ),
  program(
    "prog-river-cyber",
    "uni-river",
    "dept-river-cs",
    "网络空间安全",
    "EXAM"
  ),
  program(
    "prog-lake-cs",
    "uni-lake",
    "dept-lake-engineering",
    "计算机技术",
    "BOTH"
  ),
  program(
    "prog-lake-ee",
    "uni-lake",
    "dept-lake-engineering",
    "电子信息",
    "EXAM"
  ),
  program(
    "prog-lake-control",
    "uni-lake",
    "dept-lake-engineering",
    "控制工程",
    "EXAM"
  ),
  program(
    "prog-lake-unknown",
    "uni-lake",
    "dept-lake-engineering",
    "交叉工程",
    "UNKNOWN"
  ),
];

const sourceInputs = [
  {
    admissionYear: 2025,
    id: "src-east-cs-2025",
    rawText:
      "测试数据：2025 年计算机科学与技术考试科目为政治、英语一、数学一、专业基础 A。",
    title: "2025 测试招生目录",
  },
  {
    admissionYear: 2026,
    id: "src-east-cs-2026",
    rawText:
      "测试数据：2026 年计算机科学与技术考试科目为政治、英语一、数学一、专业基础 B。计划招生 20 人。",
    title: "2026 测试招生目录",
  },
  {
    admissionYear: 2026,
    id: "src-east-summer-2026",
    rawText:
      "测试数据：夏令营申请人 CET6 不低于 500 分。\n  报名时间为 2026 年 6 月 1 日至 6 月 15 日。",
    title: "2026 测试夏令营通知",
  },
  {
    admissionYear: 2026,
    id: "src-shanghai-programs-2026",
    rawText:
      "测试数据：软件工程与人工智能项目 2026 年均开放招生，具体名额未公布。",
    title: "2026 上海测试项目目录",
  },
  {
    admissionYear: 2026,
    id: "src-other-programs-2026",
    rawText: "测试数据：杭州与南京测试项目 2026 年招生政策，部分字段暂缺。",
    title: "2026 其他测试项目目录",
  },
] as const;

export const fixtureSourceDocuments: SourceDocument[] = sourceInputs.map(
  (source) => ({
    admissionYear: source.admissionYear,
    canonicalUrl: `https://fixture.invalid/${source.id}`,
    contentHash: computeContentHash(source.rawText),
    createdAt: now,
    fetchedAt: now,
    id: source.id,
    publisher: "HAIWEN_SYNTHETIC_FIXTURE",
    rawText: source.rawText,
    sourceTrust: "TEST_FIXTURE",
    sourceType: "TEST_FIXTURE",
    sourceUrl: `https://fixture.invalid/${source.id}`,
    title: source.title,
    updatedAt: now,
  })
);

export const fixtureAdmissionPolicies: AdmissionPolicy[] = [
  admissionPolicy(
    "ap-east-cs-2025",
    "prog-east-cs",
    2025,
    "src-east-cs-2025",
    "专业基础 A"
  ),
  admissionPolicy(
    "ap-east-cs-2026",
    "prog-east-cs",
    2026,
    "src-east-cs-2026",
    "专业基础 B",
    20
  ),
  ...fixturePrograms
    .filter(
      (item) =>
        item.id !== "prog-east-cs" && item.admissionType !== "RECOMMENDATION"
    )
    .map((item) =>
      admissionPolicy(
        `ap-${item.id}-2026`,
        item.id,
        2026,
        item.universityId === "uni-east"
          ? "src-shanghai-programs-2026"
          : "src-other-programs-2026",
        "专业基础（测试）"
      )
    ),
];

export const fixtureRecommendationPolicies: RecommendationPolicy[] = [
  {
    admissionYear: 2026,
    applicationEnd: "2026-06-15",
    applicationStart: "2026-06-01",
    createdAt: now,
    eligibilityNotes: "测试规则，不代表真实院校要求",
    englishRequirement: "CET6 不低于 500 分",
    id: "rp-east-cs-summer-2026",
    programId: "prog-east-cs",
    sourceDocumentId: "src-east-summer-2026",
    stage: "SUMMER_CAMP",
    updatedAt: now,
  },
  {
    admissionYear: 2026,
    createdAt: now,
    eligibilityNotes: "测试规则，英语门槛未提供",
    id: "rp-river-ai-2026",
    programId: "prog-river-ai",
    sourceDocumentId: "src-other-programs-2026",
    stage: "PRE_RECOMMENDATION",
    updatedAt: now,
  },
];

const evidenceInputs = [
  [
    "EV-000001",
    "prog-east-cs",
    "src-east-cs-2025",
    "EXAM_SUBJECT",
    "2025 年计算机科学与技术考试科目为政治、英语一、数学一、专业基础 A。",
  ],
  [
    "EV-000002",
    "prog-east-cs",
    "src-east-cs-2026",
    "EXAM_SUBJECT",
    "2026 年计算机科学与技术考试科目为政治、英语一、数学一、专业基础 B。",
  ],
  [
    "EV-000003",
    "prog-east-cs",
    "src-east-cs-2026",
    "ENROLLMENT",
    "计划招生 20 人。",
  ],
  [
    "EV-000004",
    "prog-east-cs",
    "src-east-summer-2026",
    "ELIGIBILITY",
    "夏令营申请人 CET6 不低于 500 分。",
  ],
  [
    "EV-000005",
    "prog-east-cs",
    "src-east-summer-2026",
    "APPLICATION_WINDOW",
    "报名时间为 2026 年 6 月 1 日至 6 月 15 日。",
  ],
  [
    "EV-000006",
    "prog-east-se",
    "src-shanghai-programs-2026",
    "POLICY_TEXT",
    "软件工程与人工智能项目 2026 年均开放招生",
  ],
  [
    "EV-000007",
    "prog-east-ai",
    "src-shanghai-programs-2026",
    "POLICY_TEXT",
    "软件工程与人工智能项目 2026 年均开放招生",
  ],
] as const;

export const fixtureEvidence: Evidence[] = evidenceInputs.map(
  ([id, programId, sourceDocumentId, evidenceType, excerpt]) => ({
    contentHash: computeContentHash(excerpt),
    createdAt: now,
    evidenceType,
    excerpt,
    id,
    normalizedExcerpt: normalizeEvidenceText(excerpt),
    programId,
    sourceDocumentId,
  })
);

function university(id: string, name: string, city: string): University {
  return {
    active: true,
    city,
    createdAt: now,
    id,
    name,
    province: "测试省份",
    tags: ["SYNTHETIC_FIXTURE"],
    type: "TEST_FIXTURE",
    updatedAt: now,
  };
}

function department(
  id: string,
  universityId: string,
  name: string
): Department {
  return { createdAt: now, id, name, universityId, updatedAt: now };
}

function program(
  id: string,
  universityId: string,
  departmentId: string,
  name: string,
  admissionType: Program["admissionType"]
): Program {
  return {
    active: true,
    admissionType,
    createdAt: now,
    degreeType: "UNKNOWN",
    departmentId,
    disciplineCategory: "工学（测试）",
    id,
    name,
    studyMode: "FULL_TIME",
    universityId,
    updatedAt: now,
  };
}

function admissionPolicy(
  id: string,
  programId: string,
  admissionYear: number,
  sourceDocumentId: string,
  professionalSubject: string,
  plannedEnrollment?: number
): AdmissionPolicy {
  return {
    admissionYear,
    createdAt: now,
    examSubjects: [
      { category: "POLITICS", code: "101", name: "政治" },
      { category: "ENGLISH", code: "201", name: "英语一" },
      { category: "MATHEMATICS", code: "301", name: "数学一" },
      { category: "PROFESSIONAL", name: professionalSubject },
    ],
    id,
    plannedEnrollment,
    programId,
    sourceDocumentId,
    updatedAt: now,
  };
}
