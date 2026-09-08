import { expect, it } from "vitest";
import { FeishuTokenProvider } from "./auth";
import { FeishuClient } from "./client";

it("retries a transient Feishu failure once", async () => {
  let calls = 0;
  const token = new FeishuTokenProvider("id", "secret", (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ code: 0, expire: 120, tenant_access_token: "token" }),
        { status: 200 }
      )
    )) as typeof fetch);
  const client = new FeishuClient("app", token, 20, (() => {
    calls += 1;
    return calls === 1
      ? Promise.resolve(
          new Response(JSON.stringify({ code: 1 }), { status: 500 })
        )
      : Promise.resolve(
          new Response(
            JSON.stringify({
              code: 0,
              data: { record: { fields: {}, record_id: "record-1" } },
            }),
            { status: 200 }
          )
        );
  }) as typeof fetch);
  expect((await client.createRecord("leads", {})).recordId).toBe("record-1");
  expect(calls).toBe(2);
});

it("times out a hanging Feishu request with a typed error", async () => {
  const token = new FeishuTokenProvider("id", "secret", (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ code: 0, expire: 120, tenant_access_token: "token" }),
        { status: 200 }
      )
    )) as typeof fetch);
  const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError"))
      );
    })) as typeof fetch;
  const client = new FeishuClient("app", token, 1, hangingFetch);
  await expect(client.createRecord("leads", {})).rejects.toMatchObject({
    code: "FEISHU_REQUEST_TIMEOUT",
  });
});
