# Scoring explainability

The v0.2 rule wrapper preserves existing numeric behavior while exposing how every result was formed. **Scoring semantics preserved pending expert calibration.** `rules-v0.2` therefore records `rulesSemanticsVersion=rules-v0.1-compatible` and `bandStatus=PROVISIONAL`.

Each contribution identifies its dimension, raw score, configured weight, contributed points, source fields, rule ID, reason code and user-safe message. Contribution totals reconcile to the deterministic score. Path traces and Program matching expose triggered rules, positive/risk factors, missing data, categorical confidence and dataset versions.

Do not interpret scores as admission probability, compare them to unverified historical acceptance rates, or expose internal rule weights/reason IDs to students. Campus converts contribution messages into current performance, impact and next-step presentation. Numeric weights change only after independent expert evidence, a reviewed Rule Candidate, regression tests and an explicit version promotion.
