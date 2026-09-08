import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { loadAndValidateSchoolDataset } from "@/domain/school/dataset-loader";
import { buildSchoolImportPlan } from "@/domain/school/import-plan";
import {
  executeSchoolImport,
  readExistingSchoolImportState,
} from "./school-import";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(
  Boolean(databaseUrl) && process.env.RUN_SCHOOL_IMPORT_INTEGRATION === "true"
);

integration("transactional school dataset import", () => {
  const sql = postgres(databaseUrl ?? "postgresql://invalid");
  beforeEach(async () => {
    await sql`TRUNCATE evidences, recommendation_policies, admission_policies, source_documents, programs, departments, universities CASCADE`;
  });
  afterAll(async () => sql.end());

  async function fixture() {
    const result = await loadAndValidateSchoolDataset(
      "data/schools/fixture/pipeline",
      "FIXTURE"
    );
    if (result.status !== "VALID") {
      throw new Error("Fixture must validate");
    }
    return result.dataset;
  }
  async function plan(dataset: Awaited<ReturnType<typeof fixture>>) {
    return buildSchoolImportPlan(
      dataset,
      await readExistingSchoolImportState(sql)
    );
  }

  it("imports relations and remains idempotent across three imports", async () => {
    const dataset = await fixture();
    const first = await executeSchoolImport(sql, dataset, await plan(dataset));
    const second = await executeSchoolImport(sql, dataset, await plan(dataset));
    const third = await executeSchoolImport(sql, dataset, await plan(dataset));
    expect(first).toMatchObject({ committed: true, created: 28 });
    expect(second).toMatchObject({
      committed: true,
      unchanged: 28,
      updated: 0,
    });
    expect(third).toMatchObject({ committed: true, unchanged: 28, updated: 0 });
    const [counts] = await sql<
      {
        universities: string;
        programs: string;
        policies: string;
        evidences: string;
      }[]
    >`SELECT (SELECT count(*) FROM universities)::text AS universities, (SELECT count(*) FROM programs)::text AS programs, ((SELECT count(*) FROM admission_policies) + (SELECT count(*) FROM recommendation_policies))::text AS policies, (SELECT count(*) FROM evidences)::text AS evidences`;
    expect(counts).toEqual({
      evidences: "10",
      policies: "4",
      programs: "4",
      universities: "2",
    });
    const [relation] = await sql<
      { universityId: string; departmentId: string; sourceId: string }[]
    >`SELECT p.university_id AS "universityId", p.department_id AS "departmentId", e.source_document_id AS "sourceId" FROM programs p JOIN evidences e ON e.program_id = p.id WHERE p.id = 'fixture:p:1' LIMIT 1`;
    expect(relation).toEqual({
      departmentId: "fixture:d:1",
      sourceId: "fixture:s:1",
      universityId: "fixture:u:1",
    });
  });

  it("updates mutable metadata and preserves historical policy versions", async () => {
    const dataset = await fixture();
    await executeSchoolImport(sql, dataset, await plan(dataset));
    const next = structuredClone(dataset);
    const [university] = next.universities;
    if (!university) {
      throw new Error("Missing university");
    }
    university.name = "更新后的测试大学";
    const [historical] = next.admissionPolicies;
    if (!historical) {
      throw new Error("Missing historical policy");
    }
    next.admissionPolicies.push({
      ...historical,
      admissionYear: 2027,
      freshness: "CURRENT",
      id: "fixture:ap:2027",
    });
    const result = await executeSchoolImport(sql, next, await plan(next));
    expect(result).toMatchObject({ committed: true, created: 1, updated: 1 });
    const years = await sql<
      { admissionYear: number }[]
    >`SELECT admission_year AS "admissionYear" FROM admission_policies WHERE program_id = 'fixture:p:1' ORDER BY admission_year`;
    expect(years.map((row) => row.admissionYear)).toEqual([2026, 2027]);
  });

  it("rolls back all writes when a later planned record cannot be resolved", async () => {
    const dataset = await fixture();
    const importPlan = await plan(dataset);
    importPlan.evidences.push({
      action: "CREATE",
      entityType: "EVIDENCE",
      externalId: "missing",
      reason: "test failure",
    });
    const result = await executeSchoolImport(sql, dataset, importPlan);
    expect(result.committed).toBe(false);
    const [{ count }] = await sql<
      { count: string }[]
    >`SELECT count(*)::text AS count FROM universities`;
    expect(count).toBe("0");
  });
});
