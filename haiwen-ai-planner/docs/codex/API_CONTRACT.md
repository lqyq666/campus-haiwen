# Campus–Haiwen API contract

The frozen machine-readable contract is `contracts/campus-haiwen-v0.2.json`. v0.2 is a backward-compatible extension of existing endpoints; no parallel `/v2` routes were introduced.

| Endpoint | Caller | Contract |
| --- | --- | --- |
| `POST /api/assessment` | Campus/server or public assessment UI | `{ assessmentVersion: "assessment-v0.2", admissionYear, profile }`; returns canonical profile, `assessment-report-v0.2`, source documents, narrative and warnings. Omitted version returns legacy tier serialization. |
| `POST /api/leads` | Campus server | Contact, canonical profile/report, assessment/session/cohort IDs and consultation intent. PostgreSQL commits before best-effort Feishu. Student response exposes lead ID and qualification, never numeric Lead Score. |
| `POST /api/events` | Campus server | Strict `analytics-event-v0.2`; `eventId` is the idempotency key and all entity identifiers except it/type/time are optional. |
| `GET /api/analytics/funnel` | authenticated internal user | Optional `from`, `to`, `cohortTag`; returns steps and rates. |
| `/api/calibration/*` | internal calibration key | Blind case open, immutable review submit, reveal, dashboard, anonymous CSV/JSON export, and proposed Rule Candidates. |

Campus server requests use `X-Campus-Channel-Key`; Calibration uses `X-Calibration-Admin-Key`. Invalid body/version is `400`, missing internal credentials `401`, missing calibration objects `404`, immutable review collision `409`, and runtime unavailability `503`.

Compatibility: legacy `SAFE` is accepted and emitted only for default `assessment-v0.1`; canonical v0.2 output is `CONSERVATIVE`. Add fields before removing fields, and update the contract, request/response tests, Campus client, and this document together.
