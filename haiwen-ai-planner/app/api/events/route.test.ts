import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ ingest: vi.fn() }));
vi.mock("@/lib/repositories/school-data", () => ({
  getRuntimeSchoolDataRepositories: () => ({
    analyticsEventRepository: repository,
  }),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/events", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("POST /api/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an idempotent duplicate response", async () => {
    repository.ingest.mockResolvedValue(false);
    const response = await POST(
      request({
        eventId: "event-1",
        eventType: "REPORT_VIEWED",
        occurredAt: "2026-08-30T00:00:00.000Z",
        sessionId: "session-1",
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "DUPLICATE" });
  });

  it("rejects malformed events", async () => {
    expect((await POST(request({ eventType: "REPORT_VIEWED" }))).status).toBe(
      400
    );
    expect(repository.ingest).not.toHaveBeenCalled();
  });
});
