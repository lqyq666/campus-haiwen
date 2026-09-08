# Campus analytics forwarding

Backend intake emits session created, assessment started, question answered, follow-up shown and assessment completed. Browser UI emits report, score explanation, Program, evidence, roadmap, review CTA and contact-form events. Lead/consent/CRM events are written by Haiwen during lead handling.

Every event uses the anonymous session as correlation, the `pilot_001` default cohort (overridable with `CAMPUS_COHORT_TAG`), and a stable ID. Campus rejects unknown event types and metadata keys `contact`, `name`, `phone`, `wechat`, or `email`. Delivery failure never fails the assessment response.
