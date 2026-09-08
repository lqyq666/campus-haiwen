CREATE TABLE leads (id text PRIMARY KEY, assessment_id text UNIQUE, student_profile_id text, status text NOT NULL, source text NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE lead_contacts (lead_id text PRIMARY KEY REFERENCES leads(id), name text, phone text, wechat text, email text, preferred_contact_method text, consent_to_contact boolean NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE lead_events (id text PRIMARY KEY, lead_id text NOT NULL REFERENCES leads(id), type text NOT NULL, occurred_at timestamptz NOT NULL, metadata jsonb, event_key text UNIQUE);
CREATE TABLE lead_scores (id bigserial PRIMARY KEY, lead_id text NOT NULL REFERENCES leads(id), score jsonb NOT NULL, calculated_at timestamptz NOT NULL);
CREATE TABLE lead_handoffs (lead_id text PRIMARY KEY REFERENCES leads(id), context jsonb NOT NULL, updated_at timestamptz NOT NULL);
CREATE INDEX lead_events_lead_idx ON lead_events (lead_id, occurred_at);
