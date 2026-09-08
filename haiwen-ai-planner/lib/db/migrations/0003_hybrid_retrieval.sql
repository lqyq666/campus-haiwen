CREATE TABLE IF NOT EXISTS document_chunks (
  id text PRIMARY KEY,
  source_document_id text NOT NULL REFERENCES source_documents(id),
  program_id text REFERENCES programs(id),
  admission_year integer CHECK (admission_year BETWEEN 2000 AND 2100),
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  content text NOT NULL CHECK (btrim(content) <> ''),
  normalized_content text NOT NULL CHECK (btrim(normalized_content) <> ''),
  content_hash text NOT NULL CHECK (btrim(content_hash) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_document_id, program_id, chunk_index, content_hash)
);

CREATE TABLE IF NOT EXISTS embedding_records (
  chunk_id text NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  model text NOT NULL CHECK (btrim(model) <> ''),
  dimensions integer NOT NULL CHECK (dimensions > 0),
  content_hash text NOT NULL CHECK (btrim(content_hash) <> ''),
  embedding vector NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chunk_id, model)
);

CREATE INDEX IF NOT EXISTS document_chunks_filter_idx ON document_chunks (admission_year, program_id);
