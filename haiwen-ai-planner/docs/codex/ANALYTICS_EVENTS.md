# Analytics events v0.2

Haiwen PostgreSQL is the source of truth. `event_id` is unique; retries return `DUPLICATE` without a second row. Optional identifiers are `session_id`, `student_profile_id`, `lead_id`, and `program_id`. Every event records metadata, `occurred_at`, server `received_at`, schema version and optional cohort such as `pilot_001`. PII is not valid analytics metadata.

Vocabulary covers session/intake questions/follow-ups/completion, report/score/Program/evidence/roadmap engagement, review CTA/contact/lead/consent, CRM start/success/failure, consultant contact, appointment and sale.

The funnel reports distinct subjects for assessment start → completion → report → evidence → review CTA → lead → consent → consultant contact → appointment → sale. Each rate divides a step by its preceding step and is filterable by half-open time range `[from,to)` and cohort. Zero denominator returns zero. Event arrival order does not alter idempotency or chronological repository reads.
