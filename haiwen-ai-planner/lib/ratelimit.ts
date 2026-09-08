import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { ChatbotError } from "@/lib/errors";

export type RateLimitScope =
  | "assessment"
  | "assessment-channel"
  | "chat"
  | "event"
  | "lead";

const POLICIES: Record<RateLimitScope, { max: number; ttlSeconds: number }> = {
  assessment: { max: 30, ttlSeconds: 60 * 60 },
  "assessment-channel": { max: 600, ttlSeconds: 60 * 60 },
  chat: { max: 10, ttlSeconds: 60 * 60 },
  event: { max: 1200, ttlSeconds: 60 * 60 },
  lead: { max: 300, ttlSeconds: 60 * 60 },
};

const localWindows = new Map<string, { count: number; expiresAt: number }>();

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client && process.env.REDIS_URL) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", () => undefined);
    client.connect().catch(() => {
      client = null;
    });
  }
  return client;
}

export function consumeLocalRateLimit(
  key: string,
  max: number,
  ttlSeconds: number,
  now = Date.now()
) {
  const current = localWindows.get(key);
  if (!current || current.expiresAt <= now) {
    localWindows.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
    return;
  }
  if (current.count >= max) {
    throw new ChatbotError("rate_limit:chat");
  }
  current.count += 1;
}

export async function checkIpRateLimit(
  ip: string | undefined,
  scope: RateLimitScope = "chat"
) {
  if (!isProductionEnvironment || !ip) {
    return;
  }

  const policy = POLICIES[scope];
  consumeLocalRateLimit(`${scope}:${ip}`, policy.max, policy.ttlSeconds);

  const redis = getClient();
  if (!redis?.isReady) {
    return;
  }

  try {
    const key = `ip-rate-limit:${scope}:${ip}`;
    const [count] = await redis
      .multi()
      .incr(key)
      .expire(key, policy.ttlSeconds, "NX")
      .exec();

    if (typeof count === "number" && count > policy.max) {
      throw new ChatbotError("rate_limit:chat");
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
  }
}
