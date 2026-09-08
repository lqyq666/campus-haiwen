# Campus Active Runtime

## Active request path

```text
Browser: qna.html + static/js/pages/qna.js
  ↓
FastAPI: app/__init__.py + app/routes.py
  ↓
Deterministic intake: app/assessment_intake.py
  ↓
HaiwenClient: app/haiwen_client.py
  ↓
Haiwen /api/assessment, /api/events and /api/leads
```

Campus owns the anonymous session and result rendering. Haiwen owns scoring, path selection, school matching, official evidence, roadmap, lead score and Feishu projection.

## CDUT Lite runtime

- The active channel is for 成都理工大学 students only.
- `app/assessment_intake.py` fixes `school` to `成都理工大学`; it never asks the student for a school.
- The first answer is `college`, followed by free-text `major` and the bounded required profile.
- The default analytics cohort is `pilot_001_cdut`.
- `CAMPUS_TARGET_ADMISSION_YEAR` controls the operational admission year default without adding another student question.
- Campus does not apply college-specific or CDUT-specific scoring weights.

## Active files

- `app/__init__.py`
- `app/routes.py`
- `app/assessment_intake.py`
- `app/assessment_store.py`
- `app/haiwen_client.py`
- `app/config.py`
- `qna.html`
- `static/js/pages/qna.js`
- `static/css/pages/qna.css`
- `app/privacy.py`
- `contracts/campus-haiwen-v0.2.json`

## Inactive / legacy files

- `app/knowledge_base.py` and `data/knowledge/admissions_sources.json`: preserved legacy/supplementary material; never called by the active assessment path.
- `data/chroma_db/`: preserved generated legacy index; not initialized at startup.
- `app/agent/`, `app/tools/`, `app/auth.py`, `app/payment.py`, `app/llm.py`, `app/session.py`, `app/user_auth.py`: old application implementation, not imported by the active FastAPI runtime.
- `admin.html`, `dashboard.html`, `index.html` and their static page scripts: retained files with no active FastAPI route; requests return `404`.

## Data ownership

- Campus SQLite (`data/assessment_sessions.db`): anonymous token, intake state, completed non-PII profile/report, message history and Haiwen lead id. It never stores contact fields.
- Haiwen: the authoritative AssessmentReport, Evidence, SourceDocument, LeadContact, LeadEvent, LeadScore, analytics funnel and CRM state.
