# Target Architecture V1

| Layer | Responsibilities |
| --- | --- |
| Campus Advisor | Conversation UX, deterministic profile intake, anonymous session, presentation mapping, lead capture form and server-side Haiwen HTTP adapter. |
| Haiwen AI Planner | Student assessment, scoring, path router, official school facts, evidence, matching, roadmap, lead lifecycle, lead scoring and Feishu projection. |

The Campus assessment result renders only the `report`, `evidenceIndex` and `sourceDocuments` returned by Haiwen. Campus does not call its Chroma store in the active assessment path.

Lead payloads travel Browser → Campus server → Haiwen. Contact details are forwarded transiently and are not persisted in Campus SQLite. Repeated submissions use the Campus session id as the stable Haiwen `assessmentId`; Haiwen owns idempotency and CRM/Feishu behavior.

Deployment limit: Campus uses SQLite and is intended for one worker. Haiwen and Campus run as separate local services during the demo (`8002` and `3011`).
