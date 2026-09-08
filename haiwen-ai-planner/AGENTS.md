# Haiwen repository rules

Haiwen is the sole business source of truth for StudentProfile validation, scoring, path, Program matching, official evidence, action priorities, Lead Score, LeadHandoffContext, analytics, and CRM projection. Keep Campus-facing changes compatible with `contracts/campus-haiwen-v0.2.json`; read `docs/codex/API_CONTRACT.md` when changing an endpoint or payload.

## Execution

1. Preserve deterministic boundaries: rules and repository facts decide scores, paths, tiers, confidence, evidence, and lead classification. LLM output may only improve narrative wording and may not introduce facts.
2. Evidence shown as verified must resolve to a stored `SourceDocument`, an allowed official/test URL, matching content integrity, and explicit freshness. Read `docs/codex/DATA_MODEL.md` when changing evidence or school data.
3. Add database changes as forward SQL migrations and update `lib/db/migrations/meta/_journal.json`. Run `pnpm db:check` and the isolated test migration before claiming migration success.
4. Persist leads locally before best-effort CRM projection. Feishu failures remain observable and never roll back or fail lead capture. Project only contacts whose explicit consent makes `contactable=true`.
5. Keep secrets in runtime environment variables. Commit examples and names, never real keys, contact data, or credentials.
6. Verify modified behavior with focused tests, then `pnpm typecheck`, `pnpm test`, and `pnpm build`. For database behavior, run integration tests against a local `*_test` database.

## Definition of Done

A change is done only when the contract remains explicit, deterministic facts are traceable and versioned, migrations are forward-safe, consent/evidence boundaries have tests, relevant tests and build pass, the diff contains no unrelated edits or secrets, and affected `docs/codex` documentation is current. Scoring and matching remain engineering models pending real expert calibration.
