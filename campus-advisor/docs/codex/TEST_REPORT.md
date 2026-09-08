# Campus Advisor v0.2 test report

Date: 2026-08-30

| Command / check | Result |
| --- | --- |
| `.\.venv-test\Scripts\python.exe -m unittest discover -s tests -v` | PASS: 15 passed, 0 failed |
| `.\.venv-test\Scripts\python.exe -m compileall -q app` | PASS |
| `node --check static/js/pages/qna.js` | PASS |
| Live Campus `:8002` → Haiwen `:3011` smoke | PASS: bounded dynamic intake, 3 Programs, 6 Evidence, 4 structured actions over 30/60/90 days, event delivery, Lead idempotency and PII-free history |
| In-app browser full flow | PASS: score explanations, top risks, Program expansion, official publisher/year/freshness/link, roadmap, CTA and unchecked consent |

The client contract tests cover v0.2 response validation, duplicate event acceptance, a single safe retry for transport failure, and no retry for non-idempotent assessment submission. The local full-flow sample took about 3.5 seconds; it is a smoke observation rather than a controlled benchmark.
