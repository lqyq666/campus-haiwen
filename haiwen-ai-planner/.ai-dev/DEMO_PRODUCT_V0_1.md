# Demo product v0.1

## User flow

`/` introduces the planning demo and leads to `/assessment`. The assessment is
a seven-step, guest-friendly StudentProfile capture. Its result shows the
deterministic path and scores first, then school matches, official evidence,
actions, optional AI interpretation, and lead capture.

## Student-visible facts

- Scores are competitiveness diagnostics, never admission probabilities.
- School tiers are relative matching levels, never admission promises.
- Official evidence remains collapsed until a student opens a school card.
- Current and historical information use distinct wording; historical facts do
  not become current-year policy.

## CTA and privacy

The first CTA follows the value-bearing report. Contact consent is mandatory
and unchecked by default. Choosing consultation sends the existing
`REQUESTED_CONSULTATION` event. PostgreSQL remains the source of truth if the
Feishu projection is unavailable.

## Hidden internal details

Students do not see lead scores, CRM qualification, RAG, pgvector, LangGraph,
or evidence/source identifiers.

## Demo cases

- A: 大二计算机、专业前 8%、CET6 530、有科研、江浙沪。
- B: 大二/大三、专业前 15%、英语一般、省赛、科研较弱。
- C: 大三、专业前 35%、仅 CET4、科研较弱、以考研为主。

## Limitations

The real seed covers five universities and 11 programs. Missing 2027 policies
are presented as incomplete/historical information, never fabricated.
