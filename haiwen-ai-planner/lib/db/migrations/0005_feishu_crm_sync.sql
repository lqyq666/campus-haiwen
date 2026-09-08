CREATE TABLE lead_external_sync (
  lead_id text PRIMARY KEY REFERENCES leads(id),
  external_system text NOT NULL,
  external_record_id text,
  sync_status text NOT NULL,
  last_synced_at timestamptz,
  last_error text,
  notification_status text NOT NULL DEFAULT 'PENDING',
  notification_sent_at timestamptz,
  notification_key text,
  updated_at timestamptz NOT NULL
);
