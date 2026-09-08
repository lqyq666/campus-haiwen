# Campus integration

Active path: browser → Campus anonymous session/intake → `app/haiwen_client.py` → Haiwen assessment/events/leads → PostgreSQL → optional Feishu projection.

Campus requests `assessment-v0.2` and rejects a mismatched report version. It stores only anonymous intake state, non-PII canonical profile/report cache, history and Haiwen lead ID. Contact fields are forwarded directly and excluded from SQLite/history/logs. Configuration-driven follow-ups cover research, competition, English, missing cohort size and broad target direction with a hard round limit.

Browser events go to authenticated `/api/assessment/event`, where Campus enforces an allowlist and rejects PII metadata before forwarding with the channel key. Stable event IDs make retries safe. Campus may report delivery failure but assessment remains usable.

Production requires matching `HAIWEN_CAMPUS_API_KEY` and `CAMPUS_CHANNEL_API_KEY`. Keep real values out of Git. The corresponding machine contract exists in both repositories.
