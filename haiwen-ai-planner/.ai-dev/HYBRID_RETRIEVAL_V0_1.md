# Hybrid Retrieval v0.1

`hybrid-retrieval-v0.1` deterministically chunks normalized source text by bounded character windows and sentence boundaries. Chunks retain source, optional program, year, index, and the shared SHA-256 content hash.

PostgreSQL stores chunks and pgvector embedding records keyed by `(chunkId, model)`. Query retrieval applies admission-year and program filters before keyword/vector ranking. Keyword retrieval uses deterministic substring matching as the Chinese-search MVP baseline; pgvector uses exact similarity search, not ANN.

Results use Reciprocal Rank Fusion. If embedding configuration or calls fail, retrieval reports `KEYWORD_FALLBACK` rather than pretending to be hybrid. Current school data is TEST_FIXTURE; Chinese FTS and real historical admissions data remain future work.
