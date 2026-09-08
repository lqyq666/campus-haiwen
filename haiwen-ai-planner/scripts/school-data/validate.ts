import { join } from "node:path";
import { loadAndValidateSchoolDataset } from "@/domain/school/dataset-loader";

async function main() {
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
    console.log(
      "Dataset: real\nStatus: EMPTY\n\nNo real school dataset is currently installed.\nThis is expected before the official-data seed milestone."
    );
    return;
  }

  console.log(`Dataset validation\nType: ${result.datasetType}`);
  for (const [key, value] of Object.entries(result.validation.stats)) {
    console.log(`${key}: ${value}`);
  }
  console.log(
    `Errors: ${result.validation.errors.length}\nWarnings: ${result.validation.warnings.length}\n${result.status}`
  );
  if (result.status === "INVALID") {
    process.exitCode = 1;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
