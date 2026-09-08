# School Dataset Format v0.1

## Purpose

The school dataset is the normalized data contract before school facts enter the
application's fact layer. It defines schema, provenance, freshness, references,
content-hash integrity, and evidence integrity.

It does not provide a database import pipeline, runtime dataset switching,
crawling, or LLM extraction.

## Directory layout

```text
data/schools/
├── fixture/pipeline/
│   ├── manifest.json
│   ├── universities.json
│   ├── departments.json
│   ├── programs.json
│   ├── admission-policies.json
│   ├── recommendation-policies.json
│   ├── sources.json
│   └── evidences.json
└── real/
```

`fixture/pipeline` is the file-based fixture used for tests, development, and
pipeline verification. `real` is reserved for normalized official school data.

## Dataset types

`FIXTURE` data is test and development data. Its sources use
`TEST_FIXTURE` trust and must never be presented as `OFFICIAL`.

`REAL` data is for official school facts. Every source in a populated real
dataset must have `sourceTrust: "OFFICIAL"` under the current validator.
Test data and official data must remain provenance-isolated.

## Manifest

`manifest.json` is the `SchoolDatasetManifest` and contains:

- `datasetVersion`: dataset contract/version identifier.
- `datasetType`: `FIXTURE` or `REAL`.
- `targetAdmissionYear`: admission year evaluated by this dataset.
- `generatedAt`: dataset generation timestamp.
- `scope`: included `majors` and `regions`.
- `sourcePolicy`: source-policy identifier for the dataset.

## Normalized entities

- `NormalizedUniversity`: stable university `id`, name, activity state, tags,
  and timestamps.
- `NormalizedDepartment`: stable department `id` and its `universityId`.
- `NormalizedProgram`: stable program `id`, `universityId`, `departmentId`,
  admission type, degree type, study mode, and activity state.
- `NormalizedAdmissionPolicy`: stable annual policy `id`, `programId`,
  `sourceDocumentId`, `admissionYear`, freshness, and exam subjects.
- `NormalizedRecommendationPolicy`: stable annual policy `id`, `programId`,
  `sourceDocumentId`, `admissionYear`, freshness, and recommendation stage.
- `NormalizedSourceDocument`: stable source `id`, URL, source trust, raw text,
  content hash, freshness, and timestamps.
- `NormalizedEvidence`: stable evidence `id`, source-document and program
  references, excerpt, evidence type, and excerpt content hash.

### Stable IDs

Dataset relationships use stable external dataset IDs for University,
Department, Program, SourceDocument, and Evidence. They must not depend on
PostgreSQL auto-increment IDs.

## Validation order

```text
JSON files
↓
Zod schema validation
↓
semantic validation
├── references
├── trust
├── freshness
├── content hash
└── evidence span
```

`NormalizedSchoolDatasetSchema` performs the schema pass first. On schema
failure, validation returns `INVALID_SCHEMA` with path and message and does not
run semantic validation.

## Validation errors and warnings

Current typed errors are:

- `INVALID_SCHEMA`
- `BROKEN_REFERENCE`
- `INVALID_EVIDENCE`
- `HASH_MISMATCH`
- `INVALID_FRESHNESS`
- `INVALID_SOURCE_TRUST`
- `DUPLICATE_EXTERNAL_ID`
- `DUPLICATE_CANONICAL_SOURCE`

The current warning is `HISTORICAL_FALLBACK`, emitted when admission policies
use `LATEST_OFFICIAL_HISTORICAL`.

## Freshness semantics

The allowed freshness values are `CURRENT`, `LATEST_OFFICIAL_HISTORICAL`,
`OUTDATED`, and `UNKNOWN`.

`CURRENT` means the policy applies to `targetAdmissionYear`; for example,
target year 2027, policy year 2027, and `freshness: CURRENT`.

`LATEST_OFFICIAL_HISTORICAL` permits historical official context; for example,
target year 2027 with a 2026 policy. The policy remains a 2026 fact and is not
rewritten as 2027.

Target year 2027 with policy year 2026 and `freshness: CURRENT` is invalid and
returns `INVALID_FRESHNESS`. `OUTDATED` and `UNKNOWN` remain explicit values;
the validator does not infer a different year or freshness value.

## Source, hash, and evidence integrity

For a real dataset, non-official sources return `INVALID_SOURCE_TRUST`. A
fixture source marked `OFFICIAL` also returns `INVALID_SOURCE_TRUST`.

`SourceDocument.rawText` is normalized and SHA-256 hashed by
`computeContentHash` in `domain/evidence/integrity.ts`; the validator recomputes
and compares `contentHash`.

`Evidence.excerpt` is source text, not an AI-generated conclusion.
`verifyEvidenceSpan` checks its normalized excerpt hash and confirms that the
excerpt exists in `SourceDocument.rawText`.

## Cross references

- Department → University
- Program → University and Department
- AdmissionPolicy / RecommendationPolicy → Program and SourceDocument
- Evidence → SourceDocument and Program

Broken relationships return `BROKEN_REFERENCE`; missing sources, programs, or
invalid evidence spans return `INVALID_EVIDENCE` for evidence.

## CLI and empty real datasets

```bash
pnpm schools:validate --dataset=fixture
```

The fixture currently returns `VALID`.

```bash
pnpm schools:validate --dataset=real
```

When no real dataset is installed, this returns `EMPTY` with exit code 0. EMPTY
is a valid stage state, not an invalid dataset. A partial dataset (for example,
`manifest.json` without required entity files), invalid schema, or invalid
semantic data is `INVALID` and exits non-zero.

`--dataset=real` never silently falls back to the fixture dataset.

## Import and runtime modes

`pnpm schools:import --dataset=fixture --dry-run` produces a no-write import
plan. Without `--dry-run`, the CLI performs one transactional PostgreSQL import
using planner actions: CREATE inserts, UPDATE changes mutable metadata, and
UNCHANGED/SKIP issue no writes. Re-importing an unchanged dataset is idempotent.

Runtime read mode is centralized in `createRuntimeSchoolReadRepositories`.
`SCHOOL_DATA_MODE=fixture` uses only TEST_FIXTURE data. `SCHOOL_DATA_MODE=real`
requires PostgreSQL data with OFFICIAL source trust and returns
`REAL_SCHOOL_DATA_UNAVAILABLE` when no real data is present; it never falls
back to fixture data.

## Current limitations

The repository does not yet contain a real official dataset or automated
crawling. These are later milestones.
