import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { calibrationCaseSchema } from "@/domain/calibration/models";
import {
  aggregateCalibration,
  runCalibrationCase,
} from "@/domain/calibration/runner";

async function main() {
  const directory = join(process.cwd(), "data/calibration/cases");
  const selected = process.argv
    .find((arg) => arg.startsWith("--case="))
    ?.slice(7);
  const files = (await readdir(directory)).filter(
    (file) =>
      file.endsWith(".json") && (!selected || file === `${selected}.json`)
  );
  const cases = await Promise.all(
    files.map(async (file) =>
      calibrationCaseSchema.parse(
        JSON.parse(await readFile(join(directory, file), "utf8"))
      )
    )
  );
  const report = aggregateCalibration(
    await Promise.all(cases.map(runCalibrationCase))
  );
  const output = join(process.cwd(), "artifacts/calibration");
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "latest.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await writeFile(
    join(output, "latest.md"),
    `# Calibration Report\n\nCases: ${report.caseCount}\n\n- Path agreement: ${(report.pathAccuracy * 100).toFixed(0)}%\n- Recommendation score in range: ${(report.recommendationScoreInRangeRate * 100).toFixed(0)}%\n- Exam score in range: ${(report.postgraduateScoreInRangeRate * 100).toFixed(0)}%\n- Average risk recall: ${(report.averageRiskRecall * 100).toFixed(0)}%\n- School tier agreement: ${(report.schoolTierAgreement * 100).toFixed(0)}%\n- Action priority recall: ${(report.actionPriorityRecall * 100).toFixed(0)}%\n\n## Expert review focus\n\n${report.failures.length ? report.failures.map((id) => `- ${id}`).join("\n") : "No synthetic expectation mismatches."}\n`
  );
  console.log(
    `Calibration v0.1\n\nCases: ${report.caseCount}\n\nPath agreement: ${(report.pathAccuracy * 100).toFixed(0)}%\nRecommendation score in expert range: ${(report.recommendationScoreInRangeRate * 100).toFixed(0)}%\nExam score in expert range: ${(report.postgraduateScoreInRangeRate * 100).toFixed(0)}%\nAverage risk recall: ${(report.averageRiskRecall * 100).toFixed(0)}%\nSchool tier agreement: ${(report.schoolTierAgreement * 100).toFixed(0)}%\nAction priority recall: ${(report.actionPriorityRecall * 100).toFixed(0)}%`
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
