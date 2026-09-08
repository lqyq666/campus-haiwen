import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadAndValidateSchoolDataset } from "./dataset-loader";
import {
  buildSchoolImportPlan,
  createEmptySchoolImportState,
  createSchoolImportState,
  SchoolImportAction,
} from "./import-plan";

async function loadFixtureDataset() {
  const result = await loadAndValidateSchoolDataset(
    "data/schools/fixture/pipeline",
    "FIXTURE"
  );
  if (result.status !== "VALID") {
    throw new Error("Fixture dataset must validate before import planning");
  }
  return result.dataset;
}

it("plans CREATE for every entity against an empty state", async () => {
  const plan = buildSchoolImportPlan(
    await loadFixtureDataset(),
    createEmptySchoolImportState()
  );

  expect(plan.summary).toEqual({
    create: 28,
    skip: 0,
    total: 28,
    unchanged: 0,
    update: 0,
  });
  expect(plan.programs.every((entry) => entry.action === "CREATE")).toBe(true);
});

it("plans UNCHANGED for an identical existing state", async () => {
  const dataset = await loadFixtureDataset();
  const plan = buildSchoolImportPlan(dataset, createSchoolImportState(dataset));

  expect(plan.summary).toEqual({
    create: 0,
    skip: 0,
    total: 28,
    unchanged: 28,
    update: 0,
  });
});

it("plans deterministic CREATE, UPDATE, and UNCHANGED mixed actions", async () => {
  const dataset = await loadFixtureDataset();
  const state = createSchoolImportState(dataset);
  state.universities[1] = { ...state.universities[1], name: "旧名称" };
  state.programs = state.programs.filter(
    (program) => program.id !== "fixture:p:3"
  );

  const plan = buildSchoolImportPlan(dataset, state);
  expect(plan.universities).toContainEqual(
    expect.objectContaining({
      action: SchoolImportAction.UPDATE,
      externalId: "fixture:u:2",
    })
  );
  expect(plan.programs).toContainEqual(
    expect.objectContaining({
      action: SchoolImportAction.CREATE,
      externalId: "fixture:p:3",
    })
  );
  expect(plan.universities).toContainEqual(
    expect.objectContaining({
      action: SchoolImportAction.UNCHANGED,
      externalId: "fixture:u:1",
    })
  );
  expect(buildSchoolImportPlan(dataset, state)).toEqual(plan);
});

it("creates a new policy year without updating the historical policy", async () => {
  const dataset = structuredClone(await loadFixtureDataset());
  const historicalPolicy = dataset.admissionPolicies.find(
    (policy) => policy.admissionYear === 2026
  );
  if (!historicalPolicy) {
    throw new Error("Fixture must include the historical policy");
  }
  const currentPolicy = {
    ...historicalPolicy,
    admissionYear: 2027,
    freshness: "CURRENT" as const,
    id: "fixture:ap:2027",
  };
  dataset.admissionPolicies = [historicalPolicy, currentPolicy];
  const state = createEmptySchoolImportState();
  state.admissionPolicies = [historicalPolicy];

  const plan = buildSchoolImportPlan(dataset, state);
  expect(plan.admissionPolicies).toContainEqual(
    expect.objectContaining({
      action: SchoolImportAction.UNCHANGED,
      externalId: historicalPolicy.id,
    })
  );
  expect(plan.admissionPolicies).toContainEqual(
    expect.objectContaining({
      action: SchoolImportAction.CREATE,
      externalId: currentPolicy.id,
    })
  );
});

it("does not expose a dataset for an invalid load result", async () => {
  const directory = await mkdtemp(join(tmpdir(), "school-import-invalid-"));
  await writeFile(join(directory, "manifest.json"), "{}");
  const result = await loadAndValidateSchoolDataset(directory, "REAL");

  expect(result.status).toBe("INVALID");
  expect(result).not.toHaveProperty("dataset");
});
