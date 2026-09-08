# Known limitations

- Scoring, path and Program matching are deterministic engineering baselines, not validated expert judgment, admission probability or outcome prediction.
- Synthetic calibration metrics measure fixture agreement, not real expert accuracy. The workbench is ready; real calibration has not occurred.
- The committed official school dataset is sparse and currently produced Program matches for the tested 2027 cohort; the 2028 E2E profile returned no Program recommendation. Missing data is surfaced rather than invented.
- Live Feishu delivery, duplicate suppression, manual sales-field preservation and invalid-token recovery were verified against the dedicated `Haiwen CDUT CRM` Base on 2026-08-30. Timeout and HTTP 500 behavior remains covered by deterministic integration tests rather than deliberately induced against the real tenant.
- Funnel appointment and sale stages require later CRM/operations events; the pilot currently verifies intake through consent/CRM-start events.
- Full-repository `pnpm lint` reports 126 existing CRLF/format diagnostics, primarily in untouched template/configuration files. All 89 modified or new v0.2 TypeScript/TSX/JSON files pass the scoped Biome check; unrelated baseline files were not bulk-formatted.
- Campus uses best-effort synchronous event forwarding without a durable local retry queue. Event IDs make client/server retries safe, but a prolonged Haiwen outage can leave channel events undelivered.
- The local performance sample is a smoke baseline, not a controlled benchmark: the Haiwen assessment step was observed at 43–103 ms and a complete 16-message Campus intake at about 3.5 seconds on this machine.
