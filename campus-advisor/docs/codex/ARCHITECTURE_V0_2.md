# Campus architecture v0.2

Campus is the channel layer: anonymous FastAPI session, bounded deterministic intake, vanilla-JS report UI, consent form and PII-free event forwarding. `app/haiwen_client.py` is the single active adapter. Haiwen remains the sole source of score, path, Program, evidence, action, Lead and CRM facts. Legacy Campus agent/RAG/auth/payment modules stay inactive.

SQLite contains anonymous token/intake/history, canonical non-PII assessment cache and Haiwen lead ID. It never stores contact fields. Haiwen PostgreSQL is authoritative for events and leads.
