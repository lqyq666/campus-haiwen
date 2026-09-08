import { expect, it } from "vitest";
import { FeishuTokenProvider } from "./auth";

it("caches tokens and refreshes before expiry", async () => {
  let now = 0;
  let calls = 0;
  const fetcher = () => {
    calls += 1;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          code: 0,
          expire: 120,
          tenant_access_token: `token-${calls}`,
        }),
        { status: 200 }
      )
    );
  };
  const provider = new FeishuTokenProvider(
    "id",
    "secret",
    fetcher as typeof fetch,
    () => now
  );
  expect(await provider.getToken()).toBe("token-1");
  expect(await provider.getToken()).toBe("token-1");
  now = 61_000;
  expect(await provider.getToken()).toBe("token-2");
  expect(calls).toBe(2);
});

it("throws a typed authentication error", async () => {
  const provider = new FeishuTokenProvider(
    "id",
    "secret",
    (async () =>
      new Response(JSON.stringify({ code: 999 }), {
        status: 400,
      })) as typeof fetch
  );
  await expect(provider.getToken()).rejects.toMatchObject({
    code: "FEISHU_AUTH_FAILED",
  });
});
