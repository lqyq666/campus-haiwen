# Campus repository rules

Campus is the anonymous student acquisition channel. It owns session UX, bounded structured intake, rendering, consent UI, and event forwarding. Haiwen exclusively owns scoring, paths, Program tiers/confidence, school and policy facts, evidence, action priority, Lead Score, handoff, analytics truth, and CRM state.

## Execution

1. Use only `app/haiwen_client.py` for active Haiwen calls and keep it aligned with `contracts/campus-haiwen-v0.2.json`. Read `docs/codex/CAMPUS_INTEGRATION.md` when changing the active flow.
2. Keep the active runtime FastAPI + HTML/CSS/vanilla JS. Preserve anonymous token validation and bounded dynamic follow-ups; `max_followup_rounds` must prevent loops.
3. Render Haiwen facts without recomputing or relabeling business conclusions. Never display Lead Score. Present scores as planning indicators, not admission probability or promises.
4. Consent starts false. Contact details may be forwarded to Haiwen but never stored in Campus history or SQLite; only explicit consent permits contactable CRM projection.
5. Forward allowlisted, PII-free events with stable event IDs. Haiwen PostgreSQL is the analytics source of truth; Campus delivery failures must not block the student assessment.
6. Preserve `.codex-spreadsheet-ref/`, `.codex-spreadsheet/`, `output/`, `outputs/`, and `tmp/` as user-owned untracked directories.
7. Verify with `.\.venv-test\Scripts\python.exe -m unittest discover -s tests -v`, Python compile checks, JS syntax checks, and a local Campus→Haiwen smoke test when the contract changes.

## Definition of Done

A change is done only when session authorization, contract version, bounded intake, evidence links, consent default, PII isolation, event forwarding, responsive UI, tests, and relevant documentation are verified without activating legacy Campus RAG or duplicating Haiwen business logic.
