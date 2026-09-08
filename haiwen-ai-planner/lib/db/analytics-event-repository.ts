import type postgres from "postgres";
import type {
  AnalyticsEvent,
  AnalyticsEventFilter,
} from "@/domain/analytics/models";
import type { AnalyticsEventRepository } from "@/domain/analytics/repository";

type Sql = ReturnType<typeof postgres>;

export class PostgresAnalyticsEventRepository
  implements AnalyticsEventRepository
{
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async ingest(event: AnalyticsEvent) {
    const rows = await this.sql<{ eventId: string }[]>`
      INSERT INTO analytics_events (
        event_id, event_type, session_id, student_profile_id, lead_id,
        program_id, cohort_tag, metadata, occurred_at, received_at, schema_version
      ) VALUES (
        ${event.eventId}, ${event.eventType}, ${event.sessionId ?? null},
        ${event.studentProfileId ?? null}, ${event.leadId ?? null},
        ${event.programId ?? null}, ${event.cohortTag ?? null},
        ${this.sql.json(event.metadata as never)}, ${event.occurredAt},
        ${event.receivedAt}, ${event.schemaVersion}
      )
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id AS "eventId"`;
    return rows.length === 1;
  }

  list(filter: AnalyticsEventFilter) {
    return this.sql<AnalyticsEvent[]>`
      SELECT event_id AS "eventId", event_type AS "eventType",
        session_id AS "sessionId", student_profile_id AS "studentProfileId",
        lead_id AS "leadId", program_id AS "programId", cohort_tag AS "cohortTag",
        metadata, occurred_at AS "occurredAt", received_at AS "receivedAt",
        schema_version AS "schemaVersion"
      FROM analytics_events
      WHERE (${filter.cohortTag ?? null}::text IS NULL OR cohort_tag = ${filter.cohortTag ?? null})
        AND (${filter.from ?? null}::timestamptz IS NULL OR occurred_at >= ${filter.from ?? null})
        AND (${filter.to ?? null}::timestamptz IS NULL OR occurred_at < ${filter.to ?? null})
      ORDER BY occurred_at, event_id`;
  }
}
