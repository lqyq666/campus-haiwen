# HAIWEN × CAMPUS v0.2 test report

Date: 2026-08-30  
Baselines: Haiwen `53da04a3f5180ee0a3183fdc748f2e226883fa29`; Campus `81feefefbeb2f64fae6d1be520b2ca900264d250`

## Final command evidence

| Scope | Command | Result |
| --- | --- | --- |
| Haiwen database setup | `$env:TEST_DATABASE_URL='<local-*_test-url>'; pnpm db:test:setup` | PASS: local `_test` database, all migrations and pgvector |
| Haiwen database check | `pnpm db:test:check` and `pnpm db:check` | PASS: connection/pgvector and Drizzle journal |
| Haiwen tests | `TEST_DATABASE_URL=.../haiwen_test; pnpm test` | PASS: 114 passed, 0 failed, 3 skipped; 35 files passed, 1 skipped |
| Haiwen modified-file lint | `git ls-files --modified --others --exclude-standard ...; pnpm exec biome check <89 files>` | PASS: all modified/new TS, TSX and JSON files |
| Haiwen full-repository lint | `pnpm lint` | KNOWN BASELINE DEBT: 126 format diagnostics, dominated by untouched CRLF template/config files |
| Haiwen production build | `POSTGRES_URL=.../haiwen_test; pnpm build` | PASS: migrations, TypeScript, 31 static pages and all dynamic routes including calibration/events/funnel |
| Calibration seed | `POSTGRES_URL=.../haiwen_test; pnpm calibration:seed-workbench` | PASS: 10 synthetic cases persisted |
| Calibration harness | `pnpm calibration:run` | PASS execution: 10 cases; path 70%, recommendation range 90%, exam range 90%, risk recall 87%, school tier 0%, action recall 40% |
| Campus Python | `.\.venv-test\Scripts\python.exe -m unittest discover -s tests -v` | PASS: 15 passed, 0 failed |
| Campus syntax | `node --check static/js/pages/qna.js` and `.\.venv-test\Scripts\python.exe -m compileall -q app` | PASS |
| Cross-repo smoke | live Campus `:8002` → Haiwen `:3011` → PostgreSQL/CRM adapter | PASS: 16-message intake, 3 Programs, 6 Verified Evidence records, all three roadmap windows, 4 complete actions, event delivered, idempotent Lead, PII-free history |
| Browser UI | in-app browser against `http://localhost:8002/qna.html` | PASS: full flow, score explanation, top risks, Program expansion, official source/year/freshness/link, 30/60/90 roadmap, CTA and unchecked consent |

The three skipped Haiwen tests are environment-gated school import tests; the real PostgreSQL repository integration suites for analytics, calibration lock/reveal, Lead and school data all ran in the 114-pass suite.

## Boundary and regression coverage

- Old StudentProfile fixtures and v0.1 assessment serialization remain supported.
- Ranking validation, English unknown/failed/not-taken semantics, multiple experiences and server time context are covered.
- Contribution totals, score bounds, threshold boundaries and 100-run deterministic output are covered.
- Legacy `SAFE` normalizes to canonical `CONSERVATIVE`; v0.1 responses serialize the deprecated legacy tier.
- Missing/invalid SourceDocument cannot produce verified evidence; historical evidence cannot become current.
- Blind answers remain hidden until submit, become database-locked, and reveal creates disagreements. Three-reviewer full/partial/disagreement cases are covered.
- Analytics duplicate delivery, ordering, optional IDs and funnel aggregation are covered.
- Feishu success, server failure, persisted failure/retry and duplicate notification behavior are covered with deterministic clients.
- Feishu live acceptance (2026-08-30): one consented Lead produced one Base record with all 24 required field-presence checks and three unique CRM events; repeated submission retained the same Record ID; operator-maintained sales fields survived resync; an invalid app secret left the PostgreSQL Lead intact and a subsequent official retry reached `SYNCED`.
- Timeout and HTTP 500 isolation remain deterministic integration-test coverage; they were not intentionally induced against the real Feishu tenant.
- Consent defaults false and non-consenting contacts cannot become contactable or enter CRM projection.

## Performance observation

This is a local smoke observation, not a controlled benchmark. Structured runtime logs observed a 43–103 ms Haiwen assessment step with three Program matches. The complete Campus request sequence took approximately 3.5 seconds on the test machine.
