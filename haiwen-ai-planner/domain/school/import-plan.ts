import type { SchoolDataset } from "./dataset";

export const SchoolImportAction = {
  CREATE: "CREATE",
  SKIP: "SKIP",
  UNCHANGED: "UNCHANGED",
  UPDATE: "UPDATE",
} as const;

export type SchoolImportAction =
  (typeof SchoolImportAction)[keyof typeof SchoolImportAction];

export const SchoolImportEntityType = {
  ADMISSION_POLICY: "ADMISSION_POLICY",
  DEPARTMENT: "DEPARTMENT",
  EVIDENCE: "EVIDENCE",
  PROGRAM: "PROGRAM",
  RECOMMENDATION_POLICY: "RECOMMENDATION_POLICY",
  SOURCE_DOCUMENT: "SOURCE_DOCUMENT",
  UNIVERSITY: "UNIVERSITY",
} as const;

export type SchoolImportEntityType =
  (typeof SchoolImportEntityType)[keyof typeof SchoolImportEntityType];

type ImportableEntity = Record<string, unknown> & { id: string };

export type SchoolImportPlanEntry = {
  action: SchoolImportAction;
  changedFields?: string[];
  entityType: SchoolImportEntityType;
  externalId: string;
  reason: string;
};

export type SchoolImportPlanSummary = {
  create: number;
  skip: number;
  total: number;
  unchanged: number;
  update: number;
};

export type ExistingSchoolImportState = {
  admissionPolicies: ImportableEntity[];
  departments: ImportableEntity[];
  evidences: ImportableEntity[];
  programs: ImportableEntity[];
  recommendationPolicies: ImportableEntity[];
  sourceDocuments: ImportableEntity[];
  universities: ImportableEntity[];
};

export type SchoolImportPlan = {
  admissionPolicies: SchoolImportPlanEntry[];
  datasetVersion: string;
  departments: SchoolImportPlanEntry[];
  evidences: SchoolImportPlanEntry[];
  programs: SchoolImportPlanEntry[];
  recommendationPolicies: SchoolImportPlanEntry[];
  sourceDocuments: SchoolImportPlanEntry[];
  summary: SchoolImportPlanSummary;
  universities: SchoolImportPlanEntry[];
};

export function createEmptySchoolImportState(): ExistingSchoolImportState {
  return {
    admissionPolicies: [],
    departments: [],
    evidences: [],
    programs: [],
    recommendationPolicies: [],
    sourceDocuments: [],
    universities: [],
  };
}

export function createSchoolImportState(
  dataset: SchoolDataset
): ExistingSchoolImportState {
  return {
    admissionPolicies: structuredClone(dataset.admissionPolicies),
    departments: structuredClone(dataset.departments),
    evidences: structuredClone(dataset.evidences),
    programs: structuredClone(dataset.programs),
    recommendationPolicies: structuredClone(dataset.recommendationPolicies),
    sourceDocuments: structuredClone(dataset.sources),
    universities: structuredClone(dataset.universities),
  };
}

export function buildSchoolImportPlan(
  dataset: SchoolDataset,
  existingState: ExistingSchoolImportState
): SchoolImportPlan {
  const plan: SchoolImportPlan = {
    admissionPolicies: [],
    datasetVersion: dataset.manifest.datasetVersion,
    departments: [],
    evidences: [],
    programs: [],
    recommendationPolicies: [],
    sourceDocuments: [],
    summary: { create: 0, skip: 0, total: 0, unchanged: 0, update: 0 },
    universities: [],
  };

  plan.universities = buildEntries(
    SchoolImportEntityType.UNIVERSITY,
    dataset.universities,
    existingState.universities
  );
  plan.departments = buildEntries(
    SchoolImportEntityType.DEPARTMENT,
    dataset.departments,
    existingState.departments
  );
  plan.programs = buildEntries(
    SchoolImportEntityType.PROGRAM,
    dataset.programs,
    existingState.programs
  );
  plan.admissionPolicies = buildEntries(
    SchoolImportEntityType.ADMISSION_POLICY,
    dataset.admissionPolicies,
    existingState.admissionPolicies
  );
  plan.recommendationPolicies = buildEntries(
    SchoolImportEntityType.RECOMMENDATION_POLICY,
    dataset.recommendationPolicies,
    existingState.recommendationPolicies
  );
  plan.sourceDocuments = buildEntries(
    SchoolImportEntityType.SOURCE_DOCUMENT,
    dataset.sources,
    existingState.sourceDocuments
  );
  plan.evidences = buildEntries(
    SchoolImportEntityType.EVIDENCE,
    dataset.evidences,
    existingState.evidences
  );

  for (const entry of [
    ...plan.universities,
    ...plan.departments,
    ...plan.programs,
    ...plan.admissionPolicies,
    ...plan.recommendationPolicies,
    ...plan.sourceDocuments,
    ...plan.evidences,
  ]) {
    plan.summary.total += 1;
    if (entry.action === SchoolImportAction.CREATE) {
      plan.summary.create += 1;
    } else if (entry.action === SchoolImportAction.UPDATE) {
      plan.summary.update += 1;
    } else if (entry.action === SchoolImportAction.UNCHANGED) {
      plan.summary.unchanged += 1;
    } else {
      plan.summary.skip += 1;
    }
  }

  return plan;
}

function buildEntries(
  entityType: SchoolImportEntityType,
  incoming: { id: string }[],
  existing: ImportableEntity[]
): SchoolImportPlanEntry[] {
  const existingByIdentity = new Map(
    existing.map((entity) => [importIdentity(entityType, entity), entity])
  );
  return [...incoming]
    .sort((left, right) =>
      importIdentity(entityType, left as ImportableEntity).localeCompare(
        importIdentity(entityType, right as ImportableEntity)
      )
    )
    .map((entity) => {
      const importableEntity = entity as ImportableEntity;
      return buildEntry(
        entityType,
        importableEntity,
        existingByIdentity.get(importIdentity(entityType, importableEntity))
      );
    });
}

function buildEntry(
  entityType: SchoolImportEntityType,
  entity: ImportableEntity,
  existing: ImportableEntity | undefined
): SchoolImportPlanEntry {
  if (!existing) {
    return {
      action: SchoolImportAction.CREATE,
      entityType,
      externalId: entity.id,
      reason: "No existing entity has the same stable identity",
    };
  }
  const changedFields = findChangedFields(entity, existing);
  if (changedFields.length === 0) {
    return {
      action: SchoolImportAction.UNCHANGED,
      entityType,
      externalId: entity.id,
      reason: "Normalized entity matches existing state",
    };
  }
  return {
    action: SchoolImportAction.UPDATE,
    changedFields,
    entityType,
    externalId: entity.id,
    reason: "Normalized entity metadata changed",
  };
}

function importIdentity(
  entityType: SchoolImportEntityType,
  entity: ImportableEntity
): string {
  if (
    entityType === SchoolImportEntityType.ADMISSION_POLICY ||
    entityType === SchoolImportEntityType.RECOMMENDATION_POLICY
  ) {
    return `${entity.id}:${entity.programId}:${entity.admissionYear}`;
  }
  return entity.id;
}

function findChangedFields(
  incoming: ImportableEntity,
  existing: ImportableEntity
): string[] {
  return [...new Set([...Object.keys(incoming), ...Object.keys(existing)])]
    .filter(
      (key) =>
        key !== "freshness" &&
        key !== "createdAt" &&
        key !== "updatedAt" &&
        key !== "fetchedAt"
    )
    .filter(
      (key) => stableSerialize(incoming[key]) !== stableSerialize(existing[key])
    )
    .sort();
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
