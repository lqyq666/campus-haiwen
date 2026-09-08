import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAndValidateSchoolDataset } from "./dataset-loader";

describe("official real school dataset", () => {
  it("is a valid, traceable 2027 seed with no fixture sources", async () => {
    const result = await loadAndValidateSchoolDataset(
      join(process.cwd(), "data/schools/real"),
      "REAL"
    );
    expect(result.status).toBe("VALID");
    if (result.status !== "VALID") {
      return;
    }
    expect(result.dataset.manifest.targetAdmissionYear).toBe(2027);
    expect(result.validation.stats).toMatchObject({
      evidences: 25,
      programs: 11,
      sourceDocuments: 12,
      universities: 5,
    });
    expect(
      result.dataset.sources.every(
        (source) => source.sourceTrust === "OFFICIAL"
      )
    ).toBe(true);
  });
});
