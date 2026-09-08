import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type DatasetValidation,
  type SchoolDataset,
  validateSchoolDataset,
} from "./dataset";

export type SchoolDatasetLoadResult =
  | { datasetType: "REAL"; status: "EMPTY" }
  | {
      dataset: SchoolDataset;
      datasetType: "FIXTURE" | "REAL";
      status: "VALID";
      validation: DatasetValidation;
    }
  | {
      datasetType: "FIXTURE" | "REAL";
      status: "INVALID";
      validation: DatasetValidation;
    };

const files = {
  admissionPolicies: "admission-policies.json",
  departments: "departments.json",
  evidences: "evidences.json",
  manifest: "manifest.json",
  programs: "programs.json",
  recommendationPolicies: "recommendation-policies.json",
  sources: "sources.json",
  universities: "universities.json",
} as const;

const zeroStats: DatasetValidation["stats"] = {
  departments: 0,
  evidences: 0,
  policies: 0,
  programs: 0,
  sourceDocuments: 0,
  universities: 0,
};

function invalidSchema(path: string, message: string): DatasetValidation {
  return {
    errors: [{ code: "INVALID_SCHEMA", message, path }],
    stats: zeroStats,
    valid: false,
    warnings: [],
  };
}

export async function loadAndValidateSchoolDataset(
  directory: string,
  datasetType: "FIXTURE" | "REAL"
): Promise<SchoolDatasetLoadResult> {
  try {
    const entries = await readdir(directory);
    if (
      datasetType === "REAL" &&
      entries.filter((entry) => entry !== ".gitkeep" && entry !== "README.md")
        .length === 0
    ) {
      return { datasetType, status: "EMPTY" };
    }
  } catch (error) {
    if (
      datasetType === "REAL" &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { datasetType, status: "EMPTY" };
    }
    throw error;
  }

  const data: Record<string, unknown> = {};
  const fileResults = await Promise.all(
    Object.entries(files).map(async ([field, filename]) => {
      try {
        return {
          field,
          filename,
          ok: true as const,
          value: JSON.parse(await readFile(join(directory, filename), "utf8")),
        };
      } catch (error) {
        return { error, field, filename, ok: false as const };
      }
    })
  );
  const failed = fileResults.find((result) => !result.ok);
  if (failed) {
    const validation = invalidSchema(
      failed.filename,
      failed.error instanceof Error
        ? failed.error.message
        : "Unable to read dataset file"
    );
    return {
      datasetType,
      status: "INVALID",
      validation,
    };
  }
  for (const result of fileResults) {
    if (result.ok) {
      data[result.field] = result.value;
    }
  }

  const validation = validateSchoolDataset(data);
  if (!validation.valid || !validation.dataset) {
    return {
      datasetType,
      status: "INVALID",
      validation,
    };
  }
  return {
    dataset: validation.dataset,
    datasetType,
    status: "VALID",
    validation,
  };
}
