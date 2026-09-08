# Haiwen contract

The frozen copy is `contracts/campus-haiwen-v0.2.json`. Campus sends `assessmentVersion=assessment-v0.2` and accepts only `assessment-report-v0.2`; canonical stable tier is `CONSERVATIVE`. `/api/leads` receives session/cohort context and consent, while `/api/events` receives strict PII-free `analytics-event-v0.2` events with stable IDs.

All upstream calls use `app/haiwen_client.py` and `X-Campus-Channel-Key`. Production `HAIWEN_CAMPUS_API_KEY` must equal Haiwen `CAMPUS_CHANNEL_API_KEY`.
