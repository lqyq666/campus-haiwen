# Lead Scoring Model v0.1

`lead-score-v0.1` is a deterministic engineering baseline for prioritising a planning consultant's follow-up. It is **not** a transaction probability, enrolment probability, or a promise of service outcome. It must be calibrated later against contact, consultation, and conversion data.

## Scores

- Fit (0–50) estimates whether the assessment identifies a serviceable planning need: dual-track routing, school-match or policy risk, incomplete data, and an actionable planning window.
- Intent (0–50) comes only from recorded behaviour and a valid contact method. Event rules and their maximum contributions are centralised in `domain/lead/scoring-rules.ts`; one event type contributes at most its configured cap, so page refreshes cannot inflate a score.
- Total is Fit + Intent, clamped to 0–100. Scores use a fixed epoch timestamp so identical inputs produce identical output.

## Qualification and consent

`LOW`, `NURTURE`, `QUALIFIED`, and `HOT` are thresholded by the versioned config. A `REQUESTED_CONSULTATION` event is high intent only when a valid contact method and explicit `consentToContact` are present. Without consent, a lead is never assigned `READY_FOR_CONSULTANT`, even when its score is high.

## Limitations

This version does not infer income, family background, or any sensitive trait. It does not use an LLM, embeddings, sales copy, or a CRM-vendor integration.
