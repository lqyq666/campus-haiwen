# Calibration harness v0.1

Run `pnpm calibration:run` to execute committed, anonymized calibration cases
through the formal graph and write ignored machine-readable and Markdown
reports under `artifacts/calibration/`.

A case contains an existing `StudentProfile`, admission year, and an expert
expectation. Expectations support score ranges, stable risk/action categories,
school tiers (including calibration-only `EXCLUDE`), and either
`SYNTHETIC_TEST` or future `EXPERT_REVIEW` provenance. Expert cases may record
a reviewer role and review date, but never contact information.

Metrics measure agreement with the expectation: exact path, scores-in-range,
risk and action recall, and school-tier agreement. They are not admission
prediction accuracy or an examination score. Reports only suggest human review;
they never tune production rules.
