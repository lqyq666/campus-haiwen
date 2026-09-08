CREATE TABLE analytics_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  session_id text,
  student_profile_id text,
  lead_id text REFERENCES leads(id),
  program_id text,
  cohort_tag text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  schema_version text NOT NULL,
  CONSTRAINT analytics_events_schema_version_check
    CHECK (schema_version = 'analytics-event-v0.2')
);

CREATE INDEX analytics_events_occurred_idx
  ON analytics_events (occurred_at, event_type);
CREATE INDEX analytics_events_cohort_idx
  ON analytics_events (cohort_tag, occurred_at)
  WHERE cohort_tag IS NOT NULL;
CREATE INDEX analytics_events_session_idx
  ON analytics_events (session_id, occurred_at)
  WHERE session_id IS NOT NULL;
CREATE INDEX analytics_events_lead_idx
  ON analytics_events (lead_id, occurred_at)
  WHERE lead_id IS NOT NULL;
