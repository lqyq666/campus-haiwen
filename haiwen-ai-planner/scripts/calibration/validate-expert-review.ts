import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  calibrationCaseSchema,
  expertReviewSubmissionSchema,
} from "@/domain/calibration/models";

async function main() {
  const fixture = process.argv.includes("--fixture");
  const path = fixture
    ? join(process.cwd(), "data/calibration/expert-review.fixture.json")
    : process.argv.find((arg) => arg.startsWith("--file="))?.slice(7);
  if (!path) {
    throw new Error("Use --fixture or --file=<path>");
  }
  const casesDirectory = join(process.cwd(), "data/calibration/cases");
  const ids = new Set(
    (
      await Promise.all(
        (
          await readdir(casesDirectory)
        )
          .filter((file) => file.endsWith(".json"))
          .map(
            async (file) =>
              calibrationCaseSchema.parse(
                JSON.parse(await readFile(join(casesDirectory, file), "utf8"))
              ).caseId
          )
      )
    ).values()
  );
  const submission = expertReviewSubmissionSchema.parse(
    JSON.parse(await readFile(path, "utf8"))
  );
  for (const review of submission.reviews) {
    if (!ids.has(review.caseId)) {
      throw new Error(`Unknown calibration case ID: ${review.caseId}`);
    }
  }
  console.log(
    `Expert review validation PASS: ${submission.reviews.length} reviews`
  );
}
main().catch((error) => {
  console.error(
    `Expert review validation FAIL: ${error instanceof Error ? error.message : "unknown error"}`
  );
  process.exitCode = 1;
});
