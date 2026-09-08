import { join } from "node:path";
import postgres from "postgres";
import { loadAndValidateSchoolDataset } from "@/domain/school/dataset-loader";
import {
  buildSchoolImportPlan,
  createEmptySchoolImportState,
} from "@/domain/school/import-plan";
import {
  executeSchoolImport,
  readExistingSchoolImportState,
} from "@/lib/db/school-import";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const datasetType = process.argv.includes("--dataset=fixture")
    ? "FIXTURE"
    : "REAL";
  const directory = join(
    process.cwd(),
    "data/schools",
    datasetType === "FIXTURE" ? "fixture/pipeline" : "real"
  );
  const result = await loadAndValidateSchoolDataset(directory, datasetType);
  if (result.status === "EMPTY") {
    console.log("Status: EMPTY\nNo import plan generated.");
    return;
  }
  if (result.status === "INVALID") {
    console.error("Status: INVALID\nNo import plan generated.");
    process.exitCode = 1;
    return;
  }

  if (!dryRun && !process.env.TEST_DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error("DATABASE_CONFIG_MISSING");
  }
  const connectionUrl =
    process.env.TEST_DATABASE_URL ?? process.env.POSTGRES_URL;
  const sql = dryRun || !connectionUrl ? undefined : postgres(connectionUrl);
  const plan = buildSchoolImportPlan(
    result.dataset,
    sql
      ? await readExistingSchoolImportState(sql)
      : createEmptySchoolImportState()
  );
  console.log(
    `Dataset:\n${plan.datasetVersion}\n\nMode:\n${dryRun ? "DRY_RUN" : "WRITE"}`
  );
  console.log(`\nCREATE:\nUniversities: ${plan.universities.length}`);
  console.log(`Departments: ${plan.departments.length}`);
  console.log(`Programs: ${plan.programs.length}`);
  console.log(`Admission Policies: ${plan.admissionPolicies.length}`);
  console.log(`Recommendation Policies: ${plan.recommendationPolicies.length}`);
  console.log(`Sources: ${plan.sourceDocuments.length}`);
  console.log(`Evidence: ${plan.evidences.length}`);
  console.log(
    `\nUPDATE: ${plan.summary.update}\nUNCHANGED: ${plan.summary.unchanged}\nSKIP: ${plan.summary.skip}\n\nTOTAL: ${plan.summary.total}`
  );
  if (sql) {
    const imported = await executeSchoolImport(sql, result.dataset, plan);
    await sql.end();
    console.log(
      `\nCreated: ${imported.created}\nUpdated: ${imported.updated}\nUnchanged: ${imported.unchanged}\nSkipped: ${imported.skipped}\nCommitted: ${imported.committed ? "YES" : "NO"}`
    );
    if (!imported.committed) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
