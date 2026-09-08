# Data model v0.2

`StudentProfile` supports backward-compatible academic identity/ranking, explicit English test status, structured research/competition/practice, targets, constraints, and `TimeContext`. Invalid rank/cohort combinations fail validation; unknown English is not zero.

`AssessmentReport` records assessment/report/rules/school/evidence versions and timestamps. Score results contain band, provisional status, dimensions, contribution traces, source fields, reason/rule IDs and missing data. `PathDecision` contains selected/alternative paths, triggered rules, factors and critical missing data. Program results use `STRETCH | MATCH | CONSERVATIVE | INSUFFICIENT_DATA`, confidence level, positive/risk factors, evidence coverage and dataset versions.

Only a `VerifiedEvidence` with a resolvable `SourceDocument`, valid URL, accepted source trust, content integrity and explicit relevance/freshness/strength enters `evidenceIndex`.

Migrations:

- `0006`: calibration cases, anonymous reviewers, immutable expert reviews, frozen predictions, disagreements, runs and Rule Candidates.
- `0007`: `contact_consent`, `consent_at`, `consent_version`, `contactable`, consistency constraint and contactability index. Existing consent is backfilled without inventing contact data.
- `0008`: idempotent `analytics_events` with optional session/profile/lead/Program identifiers, metadata, cohort, occurred/received timestamps and schema version.

Lead v0.2 separates Fit, Intent and Urgency. Lead quality (`LOW…HOT`) and urgency priority (`LOW…URGENT`) are independent. Handoff is structured and includes goals, risks, Programs, why-now, conversation topics/opening, prior actions, missing information and explicit no-promise boundaries.
