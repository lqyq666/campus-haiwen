# Feishu CRM Setup

1. Create a Feishu enterprise self-built application.
2. Copy its App ID and App Secret; never commit either value.
3. Enable tenant access token, Bitable read/write, and IM message permissions.
4. Publish and authorize the application in the tenant.
5. Create a CRM Base manually; this application does not create or modify Base schema.
6. Create the `线索` and `线索事件` tables using `FEISHU_BASE_SCHEMA_V0_1.md`.
7. Add the application to the Base with editor permission.
8. Copy the Base `app_token`, both table IDs, and (optionally) the test consultant or group receive ID.
9. Set `FEISHU_ENABLED=true` and the corresponding `FEISHU_*` environment variables.
10. Submit a TEST assessment contact, then verify one lead row and one event row. Re-submit it to verify update/no duplicate behaviour.

Only the configured app token and table IDs are accessed. PostgreSQL remains the product source of truth; a Feishu failure is stored for retry and does not invalidate a submitted lead.
