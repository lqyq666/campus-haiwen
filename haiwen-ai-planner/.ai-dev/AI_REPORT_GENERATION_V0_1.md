# AI Report Generation v0.1

The deterministic `AssessmentReport` remains the source of truth. The LLM receives a compact EvidencePack, allowed citation IDs, path facts, recommendation IDs/tiers, and action priorities; it may only explain and organize these inputs.

Prompt version: `haiwen-report-prompt-v0.1`. Structured output uses the installed AI SDK `generateObject` plus Zod. Narrative validation rejects unknown program IDs, unknown citations, and incomplete roadmap periods. Model metadata records provider, model, and prompt version, never keys.

Runtime allows one report generation with one bounded retry and timeout. Missing configuration, provider failure, timeout, or invalid output leaves the deterministic report available with `AI_REPORT_UNAVAILABLE`. Narrative is not a fact source. STRETCH/MATCH/SAFE are relative matching tiers, not admission probabilities; official latest policies prevail.
