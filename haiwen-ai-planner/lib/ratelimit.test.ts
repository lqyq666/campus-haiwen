import { describe, expect, it } from "vitest";
import { consumeLocalRateLimit } from "./ratelimit";

describe("local rate limit fallback", () => {
  it("rejects requests over the limit and resets after the window", () => {
    const key = `test:${crypto.randomUUID()}`;
    consumeLocalRateLimit(key, 2, 60, 1000);
    consumeLocalRateLimit(key, 2, 60, 1001);
    expect(() => consumeLocalRateLimit(key, 2, 60, 1002)).toThrow();
    expect(() => consumeLocalRateLimit(key, 2, 60, 61_001)).not.toThrow();
  });
});
