# Assumptions

1. Haiwen remains the only source of score, path, school/program matching, evidence, roadmap priority, and lead score.
2. Campus keeps FastAPI, HTML/CSS/Vanilla JavaScript, and SQLite transient session storage; no framework or database replacement is needed.
3. The current Haiwen HTTP contract will be extended additively and consumed only through `app/haiwen_client.py`.
4. Consent defaults to false, and contact data is never written to conversation history or ordinary logs.
5. Existing untracked spreadsheet/output/tmp directories are user-owned and outside this goal.
