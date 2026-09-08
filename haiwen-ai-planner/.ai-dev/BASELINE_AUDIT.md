# Baseline Audit

- Upstream revision: `vercel/chatbot@c2f8235e1f3ea903ad8b7f61447c4f74164b5c58` (`main`, 2026-07-08)
- Upstream version: `3.1.0`
- License: retained unchanged in `LICENSE`
- Runtime: Next.js 16, React 19, TypeScript, pnpm
- AI architecture: Vercel AI SDK 7; baseline selected models through Vercel AI Gateway in `lib/ai/providers.ts`
- Database architecture: Drizzle ORM with `postgres` driver and SQL migrations in `lib/db/migrations`
- Auth architecture: NextAuth 5 beta with credentials and anonymous guest providers
- Reusable modules: chat UI/routes, auth, Drizzle schema/migrations, artifacts, AI SDK streaming
- Replace: hard-wired AI Gateway model construction and Gateway model discovery
- Extend: domain modules, assessment/scoring, LangGraph, evidence retrieval, lead integration
- Known risks: upstream includes Redis-backed resumable streams and Vercel Blob uploads; these remain optional baseline paths and are not M1 core services
