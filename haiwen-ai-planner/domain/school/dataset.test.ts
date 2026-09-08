import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { computeContentHash } from "@/domain/evidence/integrity";
import {
  NormalizedSchoolDatasetSchema,
  type SchoolDataset,
  validateSchoolDataset,
} from "./dataset";
import { loadAndValidateSchoolDataset } from "./dataset-loader";

const text = "测试数据：2026 计算机科学与技术考试科目为 408。";
const dataset: SchoolDataset = {
  admissionPolicies: [
    {
      admissionYear: 2026,
      createdAt: "2026-01-01",
      examSubjects: [],
      freshness: "LATEST_OFFICIAL_HISTORICAL",
      id: "ap",
      programId: "p",
      sourceDocumentId: "s",
      updatedAt: "2026-01-01",
    },
  ],
  departments: [
    {
      createdAt: "2026-01-01",
      id: "d",
      name: "测试学院",
      universityId: "u",
      updatedAt: "2026-01-01",
    },
  ],
  evidences: [
    {
      contentHash: computeContentHash("2026 计算机科学与技术考试科目为 408。"),
      createdAt: "2026-01-01",
      evidenceType: "EXAM_SUBJECT",
      excerpt: "2026 计算机科学与技术考试科目为 408。",
      id: "e",
      programId: "p",
      sourceDocumentId: "s",
    },
  ],
  manifest: {
    datasetType: "FIXTURE",
    datasetVersion: "pipeline-fixture-v0.1",
    generatedAt: "2026-08-29T00:00:00.000Z",
    scope: { majors: ["计算机"], regions: ["测试"] },
    sourcePolicy: "TEST_FIXTURE",
    targetAdmissionYear: 2027,
  },
  programs: [
    {
      active: true,
      admissionType: "EXAM",
      createdAt: "2026-01-01",
      degreeType: "ACADEMIC",
      departmentId: "d",
      id: "p",
      name: "计算机科学与技术",
      studyMode: "FULL_TIME",
      universityId: "u",
      updatedAt: "2026-01-01",
    },
  ],
  recommendationPolicies: [],
  sources: [
    {
      contentHash: computeContentHash(text),
      createdAt: "2026-01-01",
      fetchedAt: "2026-01-01",
      freshness: "LATEST_OFFICIAL_HISTORICAL",
      id: "s",
      rawText: text,
      sourceTrust: "TEST_FIXTURE",
      sourceType: "TEST_FIXTURE",
      sourceUrl: "https://fixture.invalid/s",
      title: "测试来源",
      updatedAt: "2026-01-01",
    },
  ],
  universities: [
    {
      active: true,
      createdAt: "2026-01-01",
      id: "u",
      name: "测试大学",
      tags: [],
      updatedAt: "2026-01-01",
    },
  ],
};
it("accepts historical fallback without changing admission year", () => {
  expect(validateSchoolDataset(dataset)).toMatchObject({
    valid: true,
    warnings: ["HISTORICAL_FALLBACK"],
  });
});

it("loads and validates the file fixture", async () => {
  const result = await loadAndValidateSchoolDataset(
    "data/schools/fixture/pipeline",
    "FIXTURE"
  );

  expect(result).toMatchObject({
    status: "VALID",
    validation: { valid: true },
  });
});

it("returns EMPTY for an empty real dataset without fixture fallback", async () => {
  const directory = await mkdtemp(join(tmpdir(), "school-dataset-empty-"));
  const result = await loadAndValidateSchoolDataset(directory, "REAL");

  expect(result).toEqual({ datasetType: "REAL", status: "EMPTY" });
  expect(result).not.toHaveProperty("validation.stats.universities", 2);
});

it("rejects a partial real dataset instead of treating it as EMPTY", async () => {
  const directory = await mkdtemp(join(tmpdir(), "school-dataset-partial-"));
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify({ ...dataset.manifest, datasetType: "REAL" })
  );

  const result = await loadAndValidateSchoolDataset(directory, "REAL");
  expect(result).toMatchObject({
    status: "INVALID",
    validation: { errors: [{ code: "INVALID_SCHEMA" }] },
  });
});

it("rejects invalid current semantics and evidence", () => {
  const invalid = structuredClone(dataset);
  invalid.admissionPolicies[0].freshness = "CURRENT";
  invalid.evidences[0].excerpt = "不存在";
  expect(validateSchoolDataset(invalid).valid).toBe(false);
});

it("maps invalid nested fields and missing required fields to INVALID_SCHEMA", () => {
  const invalidProgram = structuredClone(dataset) as Record<string, unknown>;
  (
    (invalidProgram.programs as Record<string, unknown>[])[0] as Record<
      string,
      unknown
    >
  ).active = "yes";
  expect(validateSchoolDataset(invalidProgram).errors[0]).toMatchObject({
    code: "INVALID_SCHEMA",
    path: "programs.0.active",
  });

  const invalidManifest = structuredClone(dataset) as Record<string, unknown>;
  (invalidManifest.manifest as Record<string, unknown>).targetAdmissionYear =
    undefined;
  expect(validateSchoolDataset(invalidManifest).errors[0]).toMatchObject({
    code: "INVALID_SCHEMA",
    path: "manifest.targetAdmissionYear",
  });
});

it("continues semantic checks after successful schema validation", () => {
  const brokenReference = structuredClone(dataset);
  brokenReference.programs[0].departmentId = "missing";
  expect(validateSchoolDataset(brokenReference).errors).toContainEqual({
    code: "BROKEN_REFERENCE",
    id: "p",
  });

  const invalidEvidence = structuredClone(dataset);
  invalidEvidence.evidences[0].excerpt = "不存在";
  expect(validateSchoolDataset(invalidEvidence).errors).toContainEqual({
    code: "INVALID_EVIDENCE",
    id: "e",
  });

  const invalidHash = structuredClone(dataset);
  invalidHash.sources[0].contentHash = "wrong";
  expect(validateSchoolDataset(invalidHash).errors).toContainEqual({
    code: "HASH_MISMATCH",
    id: "s",
  });

  const invalidFreshness = structuredClone(dataset);
  invalidFreshness.manifest.targetAdmissionYear = 2027;
  invalidFreshness.admissionPolicies[0].freshness = "CURRENT";
  expect(validateSchoolDataset(invalidFreshness).errors).toContainEqual({
    code: "INVALID_FRESHNESS",
    id: "ap",
  });
});

it("parses the valid normalized dataset", () => {
  expect(NormalizedSchoolDatasetSchema.safeParse(dataset).success).toBe(true);
});

it("rejects invalid manifest and nested program fields", () => {
  const invalidManifest = structuredClone(dataset) as Record<string, unknown>;
  (invalidManifest.manifest as Record<string, unknown>).targetAdmissionYear =
    "2027";
  expect(NormalizedSchoolDatasetSchema.safeParse(invalidManifest).success).toBe(
    false
  );
  const invalidProgram = structuredClone(dataset) as Record<string, unknown>;
  (
    (invalidProgram.programs as Record<string, unknown>[])[0] as Record<
      string,
      unknown
    >
  ).active = "yes";
  expect(NormalizedSchoolDatasetSchema.safeParse(invalidProgram).success).toBe(
    false
  );
});
