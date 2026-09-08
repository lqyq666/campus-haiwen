# Assumptions

These assumptions are implementation constraints, not business claims.

1. Existing v0.1 numeric scoring weights, bands, path thresholds, and matching thresholds remain the compatibility baseline until independent expert judgments exist.
2. `assessment-v0.2`, `calibration-v0.2`, `program-matching-v0.2`, and `analytics-event-v0.2` describe software contracts and traceability. They do not imply expert-calibrated accuracy.
3. The verified school dataset remains `real-school-data-v0.1`. No school, program, policy, evidence, or official URL will be invented to fill gaps.
4. Haiwen's current assessment endpoint will be extended additively unless implementation evidence requires a versioned endpoint.
5. Campus protected untracked directories (`.codex-spreadsheet-ref/`, `.codex-spreadsheet/`, `output/`, `outputs/`, and `tmp/`) are outside this goal and must remain untouched and unstaged.
6. Local secrets in `.env.local` and `.env` are runtime inputs only. Changes target `.env.example`; no real secret or contact data is committed.
7. Real expert calibration is an external operational activity. The software Definition of Done is a usable blind-review workbench and measurable exports; it is not a claim that expert calibration has occurred.
8. Feishu may be unavailable locally. PostgreSQL/fixture persistence and failure-isolation tests are the authoritative development gate; live Feishu delivery remains separately reported unless credentials are supplied.
9. When a profile does not provide `monthsRemaining`, the server calculates whole calendar months to 1 September of `targetAdmissionYear`, the conventional start of the admission year. A supplied value is preserved, and this scheduling convention is not used as an admissions policy rule.
