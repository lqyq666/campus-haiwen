FROM node:22-bookworm-slim AS deps

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm install --global pnpm@10.32.1 --registry=$NPM_REGISTRY

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --registry=$NPM_REGISTRY

FROM deps AS builder

ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm exec next build

FROM deps AS migrate

COPY tsconfig.json ./
COPY lib/db/migrate.ts ./lib/db/migrate.ts
COPY lib/db/migrations ./lib/db/migrations
CMD ["pnpm", "exec", "tsx", "lib/db/migrate.ts"]

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3011

WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3011
CMD ["node", "server.js"]
