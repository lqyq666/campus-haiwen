CREATE TABLE IF NOT EXISTS universities (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  short_name text,
  province text,
  city text,
  type text,
  tags text[] NOT NULL DEFAULT '{}',
  official_website text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY,
  university_id text NOT NULL REFERENCES universities(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  short_name text,
  official_website text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS programs (
  id text PRIMARY KEY,
  university_id text NOT NULL REFERENCES universities(id),
  department_id text NOT NULL REFERENCES departments(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  code text,
  degree_type text NOT NULL DEFAULT 'UNKNOWN' CHECK (degree_type IN ('ACADEMIC', 'PROFESSIONAL', 'UNKNOWN')),
  discipline_category text,
  study_mode text NOT NULL DEFAULT 'UNKNOWN' CHECK (study_mode IN ('FULL_TIME', 'PART_TIME', 'UNKNOWN')),
  admission_type text NOT NULL DEFAULT 'UNKNOWN' CHECK (admission_type IN ('EXAM', 'RECOMMENDATION', 'BOTH', 'UNKNOWN')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_documents (
  id text PRIMARY KEY,
  source_type text NOT NULL,
  source_trust text NOT NULL CHECK (source_trust IN ('OFFICIAL', 'INSTITUTIONAL', 'TEST_FIXTURE', 'UNKNOWN')),
  source_url text NOT NULL CHECK (btrim(source_url) <> ''),
  canonical_url text,
  title text NOT NULL CHECK (btrim(title) <> ''),
  publisher text,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL,
  admission_year integer CHECK (admission_year BETWEEN 2000 AND 2100),
  content_hash text NOT NULL CHECK (btrim(content_hash) <> ''),
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS source_documents_dedupe_idx
  ON source_documents ((COALESCE(canonical_url, source_url)), content_hash);

CREATE TABLE IF NOT EXISTS admission_policies (
  id text PRIMARY KEY,
  program_id text NOT NULL REFERENCES programs(id),
  admission_year integer NOT NULL CHECK (admission_year BETWEEN 2000 AND 2100),
  planned_enrollment integer CHECK (planned_enrollment >= 0),
  recommendation_exempt_quota integer CHECK (recommendation_exempt_quota >= 0),
  exam_subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  retest_score numeric,
  notes text,
  source_document_id text NOT NULL REFERENCES source_documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, admission_year)
);

CREATE TABLE IF NOT EXISTS recommendation_policies (
  id text PRIMARY KEY,
  program_id text NOT NULL REFERENCES programs(id),
  admission_year integer NOT NULL CHECK (admission_year BETWEEN 2000 AND 2100),
  stage text NOT NULL CHECK (stage IN ('SUMMER_CAMP', 'PRE_RECOMMENDATION', 'FORMAL_RECOMMENDATION', 'OTHER')),
  application_start date,
  application_end date,
  ranking_requirement text,
  english_requirement text,
  research_requirement text,
  competition_requirement text,
  eligibility_notes text,
  source_document_id text NOT NULL REFERENCES source_documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, admission_year, stage)
);

CREATE TABLE IF NOT EXISTS evidences (
  id text PRIMARY KEY CHECK (btrim(id) <> ''),
  source_document_id text NOT NULL REFERENCES source_documents(id),
  program_id text NOT NULL REFERENCES programs(id),
  evidence_type text NOT NULL,
  excerpt text NOT NULL CHECK (btrim(excerpt) <> ''),
  start_offset integer CHECK (start_offset >= 0),
  end_offset integer CHECK (end_offset >= 0),
  normalized_excerpt text,
  content_hash text NOT NULL CHECK (btrim(content_hash) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programs_search_idx ON programs (university_id, name);
CREATE INDEX IF NOT EXISTS admission_policies_year_idx ON admission_policies (admission_year, program_id);
CREATE INDEX IF NOT EXISTS recommendation_policies_year_idx ON recommendation_policies (admission_year, program_id);
CREATE INDEX IF NOT EXISTS evidences_program_idx ON evidences (program_id, source_document_id);
