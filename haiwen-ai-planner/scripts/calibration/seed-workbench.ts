import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { calibrationCaseSchema } from "@/domain/calibration/models";
import { runCalibrationCase } from "@/domain/calibration/runner";
import type {
  CalibrationCaseV02,
  SystemPredictionSnapshot,
} from "@/domain/calibration/workbench";
import { createSchoolDataRepositories } from "@/lib/repositories/school-data";

async function main() {
  const directory = join(process.cwd(), "data/calibration/cases");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const cases = await Promise.all(
    files.map(async (file) =>
      calibrationCaseSchema.parse(
        JSON.parse(await readFile(join(directory, file), "utf8"))
      )
    )
  );
  const runtime = createSchoolDataRepositories();
  try {
    await Promise.all(
      cases.map(async (caseItem) => {
        const result = await runCalibrationCase(caseItem);
        const caseId = `calibration-case:${caseItem.caseId}`;
        const createdAt = new Date().toISOString();
        const workbenchCase: CalibrationCaseV02 = {
          caseCode: caseItem.caseId,
          createdAt,
          id: caseId,
          sourceType: "SYNTHETIC_TEST",
          status: "READY",
          studentProfileSnapshot: caseItem.profile,
        };
        const prediction: SystemPredictionSnapshot = {
          actionPriorities: result.systemResult.actionPriorities,
          caseId,
          createdAt,
          examScore: result.systemResult.postgraduateScore,
          id: `calibration-prediction:${caseItem.caseId}`,
          modelVersions: result.modelVersions,
          path: result.systemResult.path as SystemPredictionSnapshot["path"],
          recommendationScore: result.systemResult.recommendationScore,
          risks: result.systemResult.risks,
          schoolTiers: result.systemResult
            .schools as SystemPredictionSnapshot["schoolTiers"],
        };
        await runtime.calibrationRepository.upsertCase(workbenchCase);
        await runtime.calibrationRepository.upsertPrediction(prediction);
      })
    );
    console.log(`Calibration workbench seed: ${cases.length} synthetic cases`);
  } finally {
    await runtime.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
