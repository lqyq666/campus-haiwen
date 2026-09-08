# HAIWEN × CAMPUS v0.2 final report

## 1. Executive summary

The two repositories now implement the v0.2 software architecture: Haiwen remains the deterministic domain and PostgreSQL source of truth; Campus remains an anonymous acquisition channel. The result is explainable, versioned assessment, evidence-backed Program matching, a blind expert calibration workbench, consent-aware Lead/CRM handling, acquisition analytics and a real 30/60/90 roadmap.

## 2. Existing architecture discovered

Haiwen was a Next.js/LangGraph domain service with deterministic scoring, PostgreSQL/Drizzle repositories, RAG, report generation and Feishu projection. Campus was a FastAPI/Vanilla JS app with transient SQLite sessions and a centralized Haiwen adapter. Campus legacy Chroma/LangChain/LangGraph code was not part of the active assessment path and remains inactive.

## 3. Architecture changes

- Added additive v0.2 profile, score trace, path trace, Program match, verified evidence and report contracts.
- Kept score/path/tier/evidence/Lead Score decisions outside the LLM boundary.
- Froze the cross-repository assessment/event/Lead contract in JSON and OpenAPI.
- Added structured, PII-free business logs carrying request/session/lead/event identifiers and assessment duration.

## 4. Database changes

- `0006_calibration_workbench_v0_2.sql`: cases, reviewers, locked reviews, predictions, disagreements, runs and Rule Candidates; a database trigger prevents answer mutation.
- `0007_lead_consent_v0_2.sql`: consent, consent timestamp/version and contactability with backfill and constraint.
- `0008_event_analytics_v0_2.sql`: idempotent event store and funnel indexes.
- Forward migrations only. Rollback is application rollback plus retained additive tables/columns; destructive down migration is intentionally avoided.

## 5. API changes

`POST /api/assessment` supports additive `assessment-v0.2`; `POST /api/events` ingests strict idempotent analytics events; `GET /api/analytics/funnel` aggregates date/cohort funnels. Protected calibration APIs support cases, blind reviews, reveal, dashboard, export and Rule Candidate lifecycle. Campus uses the channel key only for Lead and event adapters.

## 6. Scoring changes

Recommendation and exam scores now expose bands, dimensions, contributions, source fields, reason/risk codes and rule versions. Path decisions expose alternatives, factors and missing critical data. Program matching uses canonical `CONSERVATIVE`, categorical confidence and evidence metadata.

**Scoring semantics preserved pending expert calibration.** The current weights are a versioned engineering baseline, not expert-validated accuracy or admission probability.

## 7. Calibration

The internal `/calibration` workbench enforces open → blind judgment → submit/lock → reveal → disagreement. It computes AI/expert and inter-expert metrics, supports exports and versioned PROPOSED Rule Candidates, and includes 10 clearly labelled synthetic cases. The synthetic harness results are test-fixture agreement only.

## 8. Campus changes

Campus collects academic identity, target year, rank/cohort, explicit English state, structured research/competition, targets, risk preference, path preference and time availability. Configuration-driven follow-ups are bounded to eight rounds. The report renders score explanations, top risks, relative Program matches, official evidence and specific actions grouped into 30/60/90 days.

## 9. Lead / CRM changes

Lead Score separates Fit, Intent and Urgency. The handoff gives consultants goals, risks, Programs, why-now, recommended conversation topics, prior actions and missing information without promises. Lead and handoff commit to PostgreSQL before best-effort CRM projection. Feishu failure is isolated and retry state is persisted.

## 10. Analytics

`analytics-event-v0.2` covers the vocabulary from session creation through sale conversion, uses `event_id` uniqueness, optional entity IDs and `pilot_001` cohort tags. The funnel endpoint reports completion, report/evidence/CTA, Lead/consent, consultant, appointment and sale rates.

## 11. Security / privacy engineering

Calibration uses an environment-held internal key with timing-safe comparison. Consent is explicit and default false. No-consent records remain non-contactable and are excluded from CRM projection. Campus rejects PII-shaped analytics metadata, masks logs and does not save contact details in assessment history. No production secrets were added.

## 12. Test results

Current CDUT-Lite verification: Haiwen 106 passed, 0 failed, 13 environment-gated skipped; TypeScript and production build passed. Campus: 19 passed, 0 failed; JS syntax and Python compile passed. Real local cross-repo smoke, browser UI QA and Feishu Base live acceptance passed. Exact commands and caveats are in `TEST_REPORT.md`.

## 13. Compatibility

Profile and API changes are additive/defaulted. v0.1 assessment requests remain valid. Legacy `SAFE` is accepted/serialized only at the compatibility boundary while v0.2 emits `CONSERVATIVE`. School data remains honestly versioned `real-school-data-v0.1`.

## 14. Known limitations

Real expert calibration and broader official school coverage have not occurred. Feishu live delivery, idempotency, manual-field preservation and invalid-token recovery were verified on 2026-08-30; timeout and HTTP 500 isolation remain deterministic-test evidence. Campus event delivery has one safe retry but no durable local queue. Full-repository lint retains pre-existing CRLF debt. See `KNOWN_LIMITATIONS.md`.

## 15. Expert calibration next step

Run 20 anonymized students × 3 independent experts = 60 judgments. Keep all reviews blind, inspect inter-expert agreement first, then evaluate AI disagreement. Promote a Rule Candidate only after evidence review, regression tests and an explicit version change.

## 16. Pilot next step

After calibration, run `pilot_001` with 50–100 real students and monitor assessment completion, report/evidence opens, review CTA, Lead submission, consent, consultant contact, appointment and sale. Do not interpret current scores or Lead levels as outcome predictions.
