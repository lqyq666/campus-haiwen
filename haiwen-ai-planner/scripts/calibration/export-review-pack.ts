import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  blindCaseMarkdown,
  reviewForm,
} from "@/domain/calibration/expert-review";
import { calibrationCaseSchema } from "@/domain/calibration/models";

async function main() {
  const root = join(process.cwd(), "artifacts/calibration/expert-review");
  const casesDirectory = join(process.cwd(), "data/calibration/cases");
  const cases = await Promise.all(
    (await readdir(casesDirectory))
      .filter((file) => file.endsWith(".json"))
      .map(async (file) =>
        calibrationCaseSchema.parse(
          JSON.parse(await readFile(join(casesDirectory, file), "utf8"))
        )
      )
  );
  await mkdir(join(root, "cases"), { recursive: true });
  await Promise.all(
    cases.map((item, index) =>
      writeFile(
        join(root, "cases", `case-${String(index + 1).padStart(3, "0")}.md`),
        blindCaseMarkdown(item)
      )
    )
  );
  await writeFile(
    join(root, "README.md"),
    "# 专家盲评包\n\n这是规划系统校准，不是考核专家。请独立判断，不搜索系统答案；评分请给合理区间，不要求精确分数。院校层级不是录取概率，只根据提供信息判断；无法判断时请选择信息不足，不要猜。\n"
  );
  await writeFile(join(root, "review-form.md"), reviewForm);
  await writeFile(
    join(root, "expert-expectations.template.json"),
    `${JSON.stringify({ reviews: cases.map((item) => ({ caseId: item.caseId, expertExpectation: { expectationSource: "EXPERT_REVIEW", expectedActionPriorities: [], expectedMissingData: [], expectedPath: "INSUFFICIENT_DATA", expectedTopRisks: [], reviewedAt: "", reviewerNotes: "", reviewerRole: "", schoolExpectations: [] } })) }, null, 2)}\n`
  );
  console.log(`Exported blind review pack: ${cases.length} cases`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
