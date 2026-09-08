import { expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ list: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/repositories/school-data", () => ({
  getRuntimeSchoolDataRepositories: () => ({
    analyticsEventRepository: repository,
  }),
}));

import { GET } from "./route";

it("filters the internal funnel by date and cohort", async () => {
  const response = await GET(
    new Request(
      "http://localhost/api/analytics/funnel?cohortTag=pilot_001&from=2026-08-01T00%3A00%3A00.000Z&to=2026-09-01T00%3A00%3A00.000Z"
    )
  );
  expect(response.status).toBe(200);
  expect(repository.list).toHaveBeenCalledWith({
    cohortTag: "pilot_001",
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-09-01T00:00:00.000Z",
  });
});

it("rejects an invalid date range", async () => {
  expect(
    (
      await GET(
        new Request("http://localhost/api/analytics/funnel?from=not-a-date")
      )
    ).status
  ).toBe(400);
});
