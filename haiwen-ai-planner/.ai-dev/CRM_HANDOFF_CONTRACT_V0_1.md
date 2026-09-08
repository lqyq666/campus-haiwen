# CRM Handoff Contract v0.1

The CRM boundary is `integrations/crm/contract.ts`. Its repository contract creates and updates Leads, stores Contacts separately, appends idempotent Lead Events, retains Lead Score history, and upserts a deterministic Handoff Context.

`LeadHandoffContext` contains the student summary and targets, recommended path, both M2 scores, school recommendations, risks, action priorities, current lead score, and fact-derived conversation topics. It deliberately contains no sales script.

PostgreSQL is the M5A implementation. `assessment_id` makes an assessment-to-lead capture idempotent; `event_key` makes important event retries idempotent. Events are append-only and scores are historical records.

The legal automated lifecycle is `NEW → NURTURING → QUALIFIED → READY_FOR_CONSULTANT → CONTACTED → CONVERTED` (or `CLOSED_LOST` from an active state). The transition guard prevents terminal states from moving backward.

M5B may map this vendor-neutral contract to Feishu. It must preserve explicit contact consent and must not introduce automatic outreach without that consent.
