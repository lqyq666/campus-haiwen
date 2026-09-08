# Campus Advisor v0.2 implementation plan

Campus is the student acquisition channel for the HAIWEN × CAMPUS v0.2 goal. The authoritative cross-repository plan is maintained in Haiwen at `docs/codex/IMPLEMENTATION_PLAN.md`.

Campus work is intentionally sequenced after the additive Haiwen assessment and event contracts are frozen:

Status: complete for v0.2 software delivery; real expert calibration and live Feishu verification are downstream operational work.

1. Preserve anonymous SQLite session behavior and the centralized `app/haiwen_client.py` adapter.
2. Expand structured intake with configuration-driven, bounded conditional follow-ups and backward-compatible profile serialization.
3. Render Haiwen v0.2 score explanations, path trace, program confidence, official source metadata, roadmap actions, and required disclaimer without recomputing business facts.
4. Emit idempotent channel events to Haiwen with one safe transport/5xx retry; SQLite remains transient and is not the analytics source of truth.
5. Preserve explicit, default-false consent and PII isolation; never place contact details in conversation history or logs.
6. Verify unit, contract, and Campus-to-Haiwen/CRM mock E2E flows.

Protected user-owned untracked directories are never cleaned, overwritten, or staged: `.codex-spreadsheet-ref/`, `.codex-spreadsheet/`, `output/`, `outputs/`, and `tmp/`.
