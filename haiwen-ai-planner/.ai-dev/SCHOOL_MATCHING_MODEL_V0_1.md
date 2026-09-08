# School Matching Model v0.1

`school-matching-v0.1` is a deterministic, evidence-aware matching baseline. It combines the frozen M2 scores with M3 candidate, policy, and Evidence records. It never estimates an actual admission probability.

## Meaning of tiers

`STRETCH`、`MATCH`、`SAFE` are relative internal matching tiers based on currently available data. They are **not** admission probabilities, admission guarantees, or commitments. `INSUFFICIENT_DATA` means a hard eligibility mismatch or missing current-year policy prevents a reliable relative tier.

## Dimensions and weights

| Dimension | Weight | Source |
| --- | ---: | --- |
| Profile strength | 45 | M2 recommendation/exam score selected by path |
| Policy fit | 25 | Current-year policy and explicit English eligibility |
| Target alignment | 15 | Profile city/university/major preferences |
| Evidence quality | 15 | Candidate policy evidence coverage |

Thresholds are configured centrally in `domain/recommendation/matching-config.ts`: MATCH 60, SAFE 78. Risk preference shifts thresholds by at most five points and cannot override a hard policy mismatch.

## Policy semantics

- Explicit `CET6 >= N` rules are deterministic hard requirements.
- A score below an explicit rule produces `HARD_POLICY_MISMATCH` and `INSUFFICIENT_DATA`.
- Natural-language or absent English rules are `UNKNOWN`, never PASS or FAIL; they reduce confidence.
- Only the requested `admissionYear` is current. A 2025 policy is never silently substituted for a 2026 query.

## Confidence and evidence

Confidence derives independently from profile completeness, current-year policy presence, and policy/evidence coverage. Every result records coverage by admission policy, recommendation policy, and English requirement. All results also carry `HISTORICAL_ADMISSION_DATA_MISSING`: this version has no historical admitted-student distribution.

## Known limits

There is no calibrated admissions model, real school dataset, LLM judgment, embedding, vector search, reranker, or hybrid RAG in this milestone. Synthetic fixtures remain test-only.
