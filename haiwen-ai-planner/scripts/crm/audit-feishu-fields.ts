import { config as loadEnvironment } from "dotenv";
import { FeishuTokenProvider } from "@/integrations/feishu/auth";
import { getFeishuConfig } from "@/integrations/feishu/config";

loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ quiet: true });

type FeishuEnvelope<T> = { code?: number; data?: T };
type FeishuField = { field_name: string; type: number };

async function main() {
  const config = getFeishuConfig();
  if (!config.enabled) {
    throw new Error("FEISHU_ENABLED must be true before auditing fields");
  }
  const tokens = new FeishuTokenProvider(config.appId, config.appSecret);
  for (const [table, tableId] of [
    ["线索", config.leadsTableId],
    ["事件", config.eventsTableId],
  ] as const) {
    // biome-ignore lint/performance/noAwaitInLoops: two tables are audited sequentially to keep output ordered.
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${tableId}/fields?page_size=500`,
      { headers: { Authorization: `Bearer ${await tokens.getToken()}` } }
    );
    const payload = (await response.json()) as FeishuEnvelope<{
      items?: FeishuField[];
    }>;
    if (!response.ok || payload.code) {
      throw new Error(`Unable to audit Feishu ${table} fields`);
    }
    process.stdout.write(
      `${JSON.stringify({
        fields: (payload.data?.items ?? []).map((field) => ({
          name: field.field_name,
          type: field.type,
        })),
        table,
      })}\n`
    );
    if (table === "事件") {
      const recordsResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${tableId}/records?page_size=500`,
        { headers: { Authorization: `Bearer ${await tokens.getToken()}` } }
      );
      const recordsPayload = (await recordsResponse.json()) as FeishuEnvelope<{
        items?: Array<{ fields: Record<string, unknown> }>;
      }>;
      if (!recordsResponse.ok || recordsPayload.code) {
        throw new Error("Unable to audit Feishu event records");
      }
      const eventTypes = [
        ...new Set(
          (recordsPayload.data?.items ?? [])
            .map((record) => record.fields["Event Type"])
            .filter((value): value is string => typeof value === "string")
        ),
      ].sort();
      process.stdout.write(
        `${JSON.stringify({ eventTypes, records: recordsPayload.data?.items?.length ?? 0, table })}\n`
      );
    }
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Feishu field audit failed"}\n`
  );
  process.exitCode = 1;
});
