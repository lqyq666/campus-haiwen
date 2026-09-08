# Migration guide

1. Back up the target PostgreSQL database and confirm the application version that writes existing lead contacts.
2. Deploy code that remains compatible with legacy assessment responses and `consent_to_contact`.
3. Run `pnpm db:check`, then `pnpm db:migrate`. Migrations 0006–0008 are additive; they do not drop school, assessment or lead data.
4. Verify calibration tables/answer-lock trigger, the contactability check constraint, analytics event primary key and pgvector extension.
5. Seed synthetic workbench cases with `pnpm calibration:seed-workbench` only after the school/evidence dataset is present.
6. Configure `CALIBRATION_ADMIN_KEY`, `CAMPUS_CHANNEL_API_KEY` and the matching Campus key outside Git. Smoke-test v0.1 and v0.2 assessment serialization, no-consent lead capture, consented lead capture and duplicate event ingestion.
7. Rollback application code by keeping additive columns/tables in place. Do not reverse-drop 0006–0008 during incident response; older code ignores them, which is the safer rollback path.

For local isolation use `docker compose up -d postgres`, `pnpm db:test:setup` and a local URL ending in `_test`.
