import { expect, it } from "vitest";
import { createRuntimeSchoolReadRepositories } from "./school-data";

it("keeps fixture runtime data isolated", async () => {
  const runtime = await createRuntimeSchoolReadRepositories({
    SCHOOL_DATA_MODE: "fixture",
  });
  try {
    expect(runtime.mode).toBe("fixture");
    expect(
      await runtime.schoolRepository.findPrograms({ admissionYear: 2026 })
    ).not.toHaveLength(0);
  } finally {
    await runtime.close();
  }
});

it("rejects empty real runtime data without fixture fallback", async () => {
  await expect(
    createRuntimeSchoolReadRepositories({ SCHOOL_DATA_MODE: "real" })
  ).rejects.toThrow("REAL_SCHOOL_DATA_UNAVAILABLE");
});
