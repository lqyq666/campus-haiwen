# Active Campus integration

The active browser is `qna.html` + `static/js/pages/qna.js`; FastAPI routes are in `app/routes.py`; intake rules are in `app/assessment_intake.py`; upstream calls are in `app/haiwen_client.py`.

Follow-ups are configuration-driven and limited to eight rounds. Unknown CET6 has an explicit status; missing cohort size and broad target direction trigger focused questions. The report renders Haiwen path reason, score bands/contributions, top three risks, Program confidence/factors/risks/evidence, official source metadata, actions and a review CTA. Scores are labeled as planning metrics, never admission probability.

Consent is unchecked by default. Contact values are forwarded directly, excluded from Campus storage/history, and masked from logs. Browser analytics are authenticated, allowlisted and rejected if metadata contains contact fields.
