# HAIWEN × CAMPUS v0.2 implementation plan

Status: complete (software v0.2; real expert calibration and live Feishu verification remain operational next steps)  
Baseline Haiwen revision: `53da04a3f5180ee0a3183fdc748f2e226883fa29`  
Baseline Campus revision: `81feefefbeb2f64fae6d1be520b2ca900264d250`

## Discovered baseline

- Haiwen is the deterministic domain and business source of truth. Its active assessment graph owns scoring, path routing, school matching, evidence, report, lead scoring, handoff, PostgreSQL persistence, and best-effort Feishu projection.
- Campus is the anonymous FastAPI/HTML/CSS/JavaScript acquisition channel. Its active assessment path collects structured answers, calls the centralized Haiwen client, renders Haiwen facts, and submits consented contact details. Legacy Campus RAG/agent code is inactive.
- Haiwen uses Next.js 16, TypeScript, Zod, LangGraph, Drizzle/PostgreSQL, SQL migrations, Vitest, and Playwright. Campus uses FastAPI, Pydantic, HTTPX, SQLite transient session state, and `unittest`.
- Existing scoring and matching weights are an engineering baseline pending expert calibration. v0.2 will preserve their semantics and expose their decisions; it will not invent expert weights.
- The committed real school dataset remains `real-school-data-v0.1` until separately verified data is ingested.

## Ordered phases and gates

1. **Baseline and architecture** — record repository facts, commands, compatibility policy, assumptions, and version vocabulary. Gate: baseline tests are recorded and architecture/source-of-truth boundaries are explicit.
2. **StudentProfile v0.2** — add backward-compatible academic, English status, structured research/competition/practice, targets, constraints, and time context. Gate: old fixtures parse unchanged; invalid rankings fail; unknown English is distinct from zero.
3. **Explainable scoring v0.2** — wrap current v0.1-compatible rules in versioned, deterministic score results with bands and contribution traces. Gate: golden outputs remain stable and contribution sums explain totals.
4. **Path DecisionTrace v0.2** — add selected/alternative paths, triggered rules, factors, critical missing data, and version metadata. Gate: boundary and 100-run determinism tests.
5. **Program matching v0.2** — make `CONSERVATIVE` canonical while accepting legacy `SAFE`; add categorical confidence and version/evidence metadata. Gate: migration/adapter and tier boundaries are tested.
6. **Evidence v0.2** — add deterministic relevance, freshness, and strength; enforce source integrity and year semantics. Gate: missing source, historical source, and invalid URL tests.
7. **Calibration workbench v0.2** — add migrations, repositories, protected internal UI/API, blind review lock/reveal, disagreements, metrics, inter-expert agreement, rule candidates, exports, and at least ten synthetic cases. Gate: three-reviewer agreement fixtures and blind-review security tests.
8. **Lead v0.2** — separate fit, intent, urgency and expand structured handoff without exposing lead scores to students. Gate: deterministic scoring and consent-aware status tests.
9. **Acquisition analytics v0.2** — add idempotent event ingestion, full event vocabulary, cohort tags, funnel aggregation, and CRM sync events. Gate: duplicate, ordering, optional identifier, and funnel tests.
10. **Campus contract and dynamic intake** — freeze the additive Haiwen contract, update the centralized client, configuration-driven follow-ups, bounded rounds, event retry, and report rendering. Gate: contract and Campus unit tests.
11. **CRM/consent hardening and E2E** — verify local commit before Feishu projection, masking, retries, failures, and end-to-end Campus-to-CRM mock flow. Gate: success/timeout/500/network/duplicate scenarios.
12. **Full regression and documentation** — run typecheck, unit, build, database migration, integration, contract, E2E smoke, language scan, and diff audit; complete all required `docs/codex` artifacts in both repositories.

## Compatibility policy

- Prefer additive fields and optional/defaulted parsing.
- Do not create a parallel API version until the current contract proves additive extension is insufficient.
- Keep current numeric scoring semantics as `rules-v0.1-compatible`; v0.2 metadata describes the contract, not unvalidated new expert weights.
- Accept legacy school tier `SAFE` at boundaries and normalize new output to `CONSERVATIVE`; document rollback and deprecated serialization.
- SQL changes are forward migrations only. No drop-and-recreate workflow is allowed.
- Campus never computes score, path, tier, confidence, school facts, evidence facts, roadmap priorities, or lead score.

## Baseline verification

| Repository | Command | Result |
| --- | --- | --- |
| Haiwen | `pnpm test` | 21 files passed, 3 skipped; 79 tests passed, 11 skipped |
| Campus | `.\.venv-test\Scripts\python.exe -m unittest discover -s tests -v` | 7 passed |
| Campus | `.\.venv-test\Scripts\python.exe -m pytest -q` | environment command unavailable: pytest is not installed; canonical suite uses unittest |

Full command evidence and later phase gates are maintained in `TEST_REPORT.md`.

All 17 phases passed their software gates on 2026-08-30. See `FINAL_REPORT.md` for delivered scope and `KNOWN_LIMITATIONS.md` for operational work that is deliberately not represented as completed calibration or production verification.
