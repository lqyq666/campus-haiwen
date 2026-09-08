# Architecture v0.2

## Ownership

```text
Campus browser
  -> Campus channel (anonymous session, bounded structured intake, rendering, consent)
  -> Haiwen additive HTTP contract
      -> deterministic profile validation / scoring / path / matching
      -> official Evidence -> SourceDocument chain
      -> report and 30/60/90 roadmap contract
      -> PostgreSQL lead, handoff, calibration, and analytics facts
      -> best-effort Feishu CRM projection
```

Haiwen is the only source of score, path, program, policy, evidence, matching, roadmap priority, lead score, and lead handoff facts. Campus may cache transient channel state and retry event delivery; it must not derive those facts.

## Deterministic boundary

The assessment graph receives a parsed `StudentProfile`, explicit admission year, a versioned rule set, and repository-backed school/evidence data. LLM output may improve narrative expression only. Report validation and response construction retain deterministic score, path, tier, confidence, evidence identifiers, source URLs, freshness, and lead score.

## Data stores

- PostgreSQL + Drizzle SQL migrations: authoritative school data, evidence/retrieval data, leads, CRM projection state, calibration workbench, and acquisition events.
- Campus SQLite: anonymous session, intake progress, completed response cache, and retry state only.
- Feishu: CRM projection. Projection failure never rolls back an already persisted lead.

## Version vocabulary

- Assessment contract: `assessment-v0.2`
- Rule contract: `rules-v0.2` with semantics `rules-v0.1-compatible`
- Report contract: `assessment-report-v0.2`
- Calibration contract: `calibration-v0.2`
- Matching contract: `program-matching-v0.2`
- Analytics schema: `analytics-event-v0.2`
- School facts: `real-school-data-v0.1`

Each assessment records contract/rule/school/evidence/report versions and creation time. Version labels never upgrade underlying facts implicitly.
