import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAnalyticsEvent } from "@/domain/analytics/schema";
import { PostgresAnalyticsEventRepository } from "./analytics-event-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

integration("PostgreSQL analytics event repository", () => {
  const sql = postgres(databaseUrl ?? "postgresql://invalid");
  const repository = new PostgresAnalyticsEventRepository(sql);

  beforeAll(async () => {
    await sql`TRUNCATE analytics_events`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("persists one ordered event across duplicate delivery", async () => {
    const event = parseAnalyticsEvent(
      {
        cohortTag: "pilot_001",
        eventId: "analytics-integration-1",
        eventType: "REPORT_VIEWED",
        occurredAt: "2026-08-30T00:00:00.000Z",
        sessionId: "session-integration-1",
      },
      "2026-08-30T00:00:01.000Z"
    );
    expect(await repository.ingest(event)).toBe(true);
    expect(await repository.ingest(event)).toBe(false);
    expect(await repository.list({ cohortTag: "pilot_001" })).toHaveLength(1);
  });
});
