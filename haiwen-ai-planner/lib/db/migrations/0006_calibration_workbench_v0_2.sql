CREATE TABLE calibration_cases (
  id text PRIMARY KEY,
  case_code text NOT NULL UNIQUE CHECK (btrim(case_code) <> ''),
  student_profile_snapshot jsonb NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('SYNTHETIC_TEST', 'EXPERT_REVIEW', 'REAL_ANONYMIZED')),
  status text NOT NULL DEFAULT 'READY' CHECK (status IN ('DRAFT', 'READY', 'IN_REVIEW', 'COMPLETE')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expert_reviewers (
  id text PRIMARY KEY,
  reviewer_code text NOT NULL UNIQUE CHECK (btrim(reviewer_code) <> ''),
  role_type text NOT NULL CHECK (role_type IN ('PLANNING_EXPERT', 'CONSULTANT', 'SALES_OR_OPERATIONS')),
  experience_level text NOT NULL CHECK (btrim(experience_level) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE system_prediction_snapshots (
  id text PRIMARY KEY,
  case_id text NOT NULL UNIQUE REFERENCES calibration_cases(id),
  prediction jsonb NOT NULL,
  model_versions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expert_reviews (
  id text PRIMARY KEY,
  case_id text NOT NULL REFERENCES calibration_cases(id),
  reviewer_id text NOT NULL REFERENCES expert_reviewers(id),
  judgment jsonb NOT NULL,
  submitted_at timestamptz NOT NULL,
  locked_at timestamptz NOT NULL,
  revealed_at timestamptz,
  UNIQUE (case_id, reviewer_id)
);

CREATE OR REPLACE FUNCTION prevent_expert_review_answer_changes()
RETURNS trigger AS $$
BEGIN
  IF NEW.judgment IS DISTINCT FROM OLD.judgment
    OR NEW.case_id IS DISTINCT FROM OLD.case_id
    OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'EXPERT_REVIEW_LOCKED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expert_review_answer_lock
BEFORE UPDATE ON expert_reviews
FOR EACH ROW EXECUTE FUNCTION prevent_expert_review_answer_changes();

CREATE TABLE calibration_disagreements (
  id text PRIMARY KEY,
  review_id text NOT NULL REFERENCES expert_reviews(id),
  type text NOT NULL CHECK (type IN ('PATH', 'RECOMMENDATION_SCORE', 'EXAM_SCORE', 'RISK', 'SCHOOL_TIER', 'ACTION', 'EVIDENCE', 'MISSING_DATA')),
  system_value jsonb NOT NULL,
  expert_value jsonb NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  expert_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE calibration_runs (
  id text PRIMARY KEY,
  version text NOT NULL DEFAULT 'calibration-v0.2',
  status text NOT NULL CHECK (status IN ('RUNNING', 'COMPLETE', 'FAILED')),
  metrics jsonb,
  started_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE TABLE calibration_rule_candidates (
  id text PRIMARY KEY,
  disagreement_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposal jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'REVIEWED', 'APPROVED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX calibration_cases_status_idx ON calibration_cases (status, created_at);
CREATE INDEX expert_reviews_case_idx ON expert_reviews (case_id, submitted_at);
CREATE INDEX calibration_disagreements_review_idx ON calibration_disagreements (review_id, type);
