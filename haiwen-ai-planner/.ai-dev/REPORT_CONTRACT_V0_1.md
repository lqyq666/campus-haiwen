# Assessment Report Contract v0.1

`AssessmentReport` is the typed M4A output contract, versioned as `assessment-report-v0.1`. It is data for a later presentation layer, not LLM-generated prose.

## Contents

- M2 profile completeness, path decision, recommendation score, and postgraduate-exam score.
- Versioned school recommendations with dimensions, tier, reasons, risks, missing data, confidence, and Evidence IDs.
- A report-level evidence index. Each indexed Evidence includes `sourceDocumentId`, so a recommendation can be traced to Evidence and then SourceDocument.
- Deterministic top risks, missing data, and 3–5 action priorities.

## Validation invariants

`validateAssessmentReport` requires a report version and valid ISO generation time; verifies score/confidence range 0–100; requires program IDs and typed tiers; and rejects recommendation Evidence IDs missing from `evidenceIndex`.

## Action priorities

Priorities are deterministic consequences of match risks and known profile gaps. Current codes include improving English, completing profile data, verifying policy, and clarifying targets. They do not create an LLM roadmap or a 30/60/90-day plan.
