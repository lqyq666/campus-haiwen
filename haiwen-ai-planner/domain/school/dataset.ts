import { z } from "zod";
import {
  computeContentHash,
  verifyEvidenceSpan,
} from "@/domain/evidence/integrity";
import type { Evidence, SourceDocument } from "@/domain/evidence/models";
import type {
  AdmissionPolicy,
  Department,
  Program,
  RecommendationPolicy,
  University,
} from "./models";

export const FreshnessSchema = z.enum([
  "CURRENT",
  "LATEST_OFFICIAL_HISTORICAL",
  "OUTDATED",
  "UNKNOWN",
]);
const timestamp = z.string().min(1);
const base = z.object({ id: z.string().min(1) });
export const SchoolDatasetManifestSchema = z.object({
  datasetType: z.enum(["FIXTURE", "REAL"]),
  datasetVersion: z.string().min(1),
  generatedAt: timestamp,
  scope: z.object({
    majors: z.array(z.string()),
    regions: z.array(z.string()),
  }),
  sourcePolicy: z.string().min(1),
  targetAdmissionYear: z.number().int(),
});
export const NormalizedUniversitySchema = base
  .extend({
    active: z.boolean(),
    createdAt: timestamp,
    name: z.string().min(1),
    tags: z.array(z.string()),
    updatedAt: timestamp,
  })
  .passthrough();
export const NormalizedDepartmentSchema = base
  .extend({
    createdAt: timestamp,
    name: z.string().min(1),
    universityId: z.string().min(1),
    updatedAt: timestamp,
  })
  .passthrough();
export const NormalizedProgramSchema = base
  .extend({
    active: z.boolean(),
    admissionType: z.enum(["EXAM", "RECOMMENDATION", "BOTH", "UNKNOWN"]),
    createdAt: timestamp,
    degreeType: z.enum(["ACADEMIC", "PROFESSIONAL", "UNKNOWN"]),
    departmentId: z.string().min(1),
    name: z.string().min(1),
    studyMode: z.enum(["FULL_TIME", "PART_TIME", "UNKNOWN"]),
    universityId: z.string().min(1),
    updatedAt: timestamp,
  })
  .passthrough();
const policySchema = base.extend({
  admissionYear: z.number().int(),
  createdAt: timestamp,
  freshness: FreshnessSchema,
  programId: z.string().min(1),
  sourceDocumentId: z.string().min(1),
  updatedAt: timestamp,
});
export const NormalizedAdmissionPolicySchema = policySchema
  .extend({ examSubjects: z.array(z.unknown()) })
  .passthrough();
export const NormalizedRecommendationPolicySchema = policySchema
  .extend({
    stage: z.enum([
      "SUMMER_CAMP",
      "PRE_RECOMMENDATION",
      "FORMAL_RECOMMENDATION",
      "OTHER",
    ]),
  })
  .passthrough();
export const NormalizedSourceDocumentSchema = base
  .extend({
    contentHash: z.string().min(1),
    createdAt: timestamp,
    fetchedAt: timestamp,
    freshness: FreshnessSchema.default("UNKNOWN"),
    rawText: z.string(),
    sourceTrust: z.enum([
      "OFFICIAL",
      "INSTITUTIONAL",
      "TEST_FIXTURE",
      "UNKNOWN",
    ]),
    sourceType: z.string().min(1),
    sourceUrl: z.string().url(),
    title: z.string().min(1),
    updatedAt: timestamp,
  })
  .passthrough();
export const NormalizedEvidenceSchema = base
  .extend({
    contentHash: z.string().min(1),
    createdAt: timestamp,
    evidenceType: z.enum([
      "EXAM_SUBJECT",
      "ENROLLMENT",
      "ELIGIBILITY",
      "APPLICATION_WINDOW",
      "POLICY_TEXT",
      "OTHER",
    ]),
    excerpt: z.string().min(1),
    programId: z.string().min(1),
    sourceDocumentId: z.string().min(1),
  })
  .passthrough();
export const NormalizedSchoolDatasetSchema = z.object({
  admissionPolicies: z.array(NormalizedAdmissionPolicySchema),
  departments: z.array(NormalizedDepartmentSchema),
  evidences: z.array(NormalizedEvidenceSchema),
  manifest: SchoolDatasetManifestSchema,
  programs: z.array(NormalizedProgramSchema),
  recommendationPolicies: z.array(NormalizedRecommendationPolicySchema),
  sources: z.array(NormalizedSourceDocumentSchema),
  universities: z.array(NormalizedUniversitySchema),
});

export type Freshness =
  | "CURRENT"
  | "LATEST_OFFICIAL_HISTORICAL"
  | "OUTDATED"
  | "UNKNOWN";
export type SchoolDataset = {
  manifest: {
    datasetVersion: string;
    datasetType: "FIXTURE" | "REAL";
    targetAdmissionYear: number;
    generatedAt: string;
    scope: { majors: string[]; regions: string[] };
    sourcePolicy: string;
  };
  universities: University[];
  departments: Department[];
  programs: Program[];
  admissionPolicies: (AdmissionPolicy & { freshness: Freshness })[];
  recommendationPolicies: (RecommendationPolicy & { freshness: Freshness })[];
  sources: (SourceDocument & { freshness: Freshness })[];
  evidences: Evidence[];
};
export type DatasetErrorCode =
  | "INVALID_SCHEMA"
  | "BROKEN_REFERENCE"
  | "INVALID_EVIDENCE"
  | "HASH_MISMATCH"
  | "INVALID_FRESHNESS"
  | "INVALID_SOURCE_TRUST"
  | "DUPLICATE_EXTERNAL_ID"
  | "DUPLICATE_CANONICAL_SOURCE";
export type DatasetValidation = {
  dataset?: SchoolDataset;
  errors: {
    code: DatasetErrorCode;
    id?: string;
    message?: string;
    path?: string;
  }[];
  stats: {
    departments: number;
    evidences: number;
    policies: number;
    programs: number;
    sourceDocuments: number;
    universities: number;
  };
  valid: boolean;
  warnings: string[];
};
export function validateSchoolDataset(input: unknown): DatasetValidation {
  const parsed = NormalizedSchoolDatasetSchema.safeParse(input);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return {
      errors: [
        {
          code: "INVALID_SCHEMA",
          message: issue?.message,
          path: issue?.path.join("."),
        },
      ],
      stats: {
        departments: 0,
        evidences: 0,
        policies: 0,
        programs: 0,
        sourceDocuments: 0,
        universities: 0,
      },
      valid: false,
      warnings: [],
    };
  }
  const dataset = parsed.data as SchoolDataset;
  const errors: DatasetValidation["errors"] = [];
  const ids = (items: { id: string }[]) =>
    new Set(items.map((item) => item.id));
  const universityIds = ids(dataset.universities),
    departmentIds = ids(dataset.departments),
    programIds = ids(dataset.programs),
    sourceIds = ids(dataset.sources);
  if (
    universityIds.size !== dataset.universities.length ||
    departmentIds.size !== dataset.departments.length ||
    programIds.size !== dataset.programs.length
  ) {
    errors.push({ code: "DUPLICATE_EXTERNAL_ID" });
  }
  for (const department of dataset.departments) {
    if (!universityIds.has(department.universityId)) {
      errors.push({ code: "BROKEN_REFERENCE", id: department.id });
    }
  }
  for (const program of dataset.programs) {
    if (
      !universityIds.has(program.universityId) ||
      !departmentIds.has(program.departmentId)
    ) {
      errors.push({ code: "BROKEN_REFERENCE", id: program.id });
    }
  }
  for (const source of dataset.sources) {
    if (
      dataset.manifest.datasetType === "REAL" &&
      source.sourceTrust !== "OFFICIAL"
    ) {
      errors.push({ code: "INVALID_SOURCE_TRUST", id: source.id });
    }
    if (
      dataset.manifest.datasetType === "FIXTURE" &&
      source.sourceTrust === "OFFICIAL"
    ) {
      errors.push({ code: "INVALID_SOURCE_TRUST", id: source.id });
    }
    if (source.contentHash !== computeContentHash(source.rawText ?? "")) {
      errors.push({ code: "HASH_MISMATCH", id: source.id });
    }
  }
  for (const policy of [
    ...dataset.admissionPolicies,
    ...dataset.recommendationPolicies,
  ]) {
    if (
      !programIds.has(policy.programId) ||
      !sourceIds.has(policy.sourceDocumentId)
    ) {
      errors.push({ code: "BROKEN_REFERENCE", id: policy.id });
    }
    if (
      policy.freshness === "CURRENT" &&
      policy.admissionYear !== dataset.manifest.targetAdmissionYear
    ) {
      errors.push({ code: "INVALID_FRESHNESS", id: policy.id });
    }
  }
  for (const evidence of dataset.evidences) {
    const source = dataset.sources.find(
      (item) => item.id === evidence.sourceDocumentId
    );
    if (
      !source ||
      !programIds.has(evidence.programId) ||
      !verifyEvidenceSpan(evidence, source).valid
    ) {
      errors.push({ code: "INVALID_EVIDENCE", id: evidence.id });
    }
  }
  const historical = dataset.admissionPolicies.filter(
    (item) => item.freshness === "LATEST_OFFICIAL_HISTORICAL"
  );
  return {
    dataset,
    errors,
    stats: {
      departments: dataset.departments.length,
      evidences: dataset.evidences.length,
      policies:
        dataset.admissionPolicies.length +
        dataset.recommendationPolicies.length,
      programs: dataset.programs.length,
      sourceDocuments: dataset.sources.length,
      universities: dataset.universities.length,
    },
    valid: errors.length === 0,
    warnings: historical.length ? ["HISTORICAL_FALLBACK"] : [],
  };
}
