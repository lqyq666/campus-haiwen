import { config as loadEnvironment } from "dotenv";
import { FeishuTokenProvider } from "@/integrations/feishu/auth";
import { getFeishuConfig } from "@/integrations/feishu/config";

loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ quiet: true });

type FeishuEnvelope<T> = { code?: number; data?: T };
type FeishuField = {
  field_id: string;
  field_name: string;
  type: number;
};
type FeishuRecord = {
  fields: Record<string, unknown>;
};

const fieldRenames = new Map([
  ["Lead ID", "线索编号"],
  ["Assessment ID", "测评编号"],
  ["CET4", "英语四级"],
  ["CET6", "英语六级"],
  ["Lead Level", "线索等级"],
  ["Urgency", "联系优先级"],
  ["CRM Sync Status", "同步状态"],
]);
const fieldsToDelete = ["联系方式", "保研竞争力", "考研准备度"] as const;

function textValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map(textValue).join("").trim();
  }
  if (value && typeof value === "object" && "text" in value) {
    return textValue((value as { text?: unknown }).text);
  }
  return "";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const config = getFeishuConfig();
  if (!config.enabled) {
    throw new Error("FEISHU_ENABLED must be true before migrating fields");
  }
  const tokens = new FeishuTokenProvider(config.appId, config.appSecret);
  const request = async <T>(path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`https://open.feishu.cn/open-apis${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${await tokens.getToken()}`,
        "Content-Type": "application/json",
      },
      method,
    });
    const payload = (await response.json()) as FeishuEnvelope<T>;
    if (!response.ok || payload.code) {
      throw new Error("Feishu advisor field migration request failed");
    }
    return payload.data;
  };

  const basePath = `/bitable/v1/apps/${config.appToken}/tables/${config.leadsTableId}`;
  const fieldData = await request<{ items?: FeishuField[] }>(
    `${basePath}/fields?page_size=500`
  );
  const fields = fieldData?.items ?? [];
  const fieldsByName = new Map(
    fields.map((field) => [field.field_name, field])
  );
  const recordData = await request<{ items?: FeishuRecord[] }>(
    `${basePath}/records?page_size=500`
  );
  const records = recordData?.items ?? [];

  for (const record of records) {
    const combined = textValue(record.fields.联系方式);
    const separated = ["手机号", "微信", "邮箱"]
      .map((name) => textValue(record.fields[name]))
      .filter(Boolean);
    const combinedParts = combined.split("、").filter(Boolean);
    if (combinedParts.some((part) => !separated.includes(part))) {
      throw new Error(
        "Combined contact data is not fully preserved in separate fields"
      );
    }
    for (const scoreField of ["保研竞争力", "考研准备度"]) {
      if (textValue(record.fields[scoreField])) {
        throw new Error(
          `${scoreField} contains data and cannot be deleted safely`
        );
      }
    }
  }

  const renamePlan = [...fieldRenames]
    .map(([from, to]) => ({ field: fieldsByName.get(from), from, to }))
    .filter((item): item is { field: FeishuField; from: string; to: string } =>
      Boolean(item.field)
    );
  const deletePlan = fieldsToDelete
    .map((name) => fieldsByName.get(name))
    .filter((field): field is FeishuField => Boolean(field));

  if (apply) {
    for (const { field, to } of renamePlan) {
      // biome-ignore lint/performance/noAwaitInLoops: schema changes are bounded and ordered.
      await request(`${basePath}/fields/${field.field_id}`, "PUT", {
        field_name: to,
        type: field.type,
      });
    }
    for (const field of deletePlan) {
      // biome-ignore lint/performance/noAwaitInLoops: destructive targets were validated above.
      await request(`${basePath}/fields/${field.field_id}`, "DELETE");
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      apply,
      deleted: deletePlan.map((field) => field.field_name),
      inspectedRecords: records.length,
      renamed: renamePlan.map(({ from, to }) => `${from} -> ${to}`),
    })}\n`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Feishu advisor field migration failed"}\n`
  );
  process.exitCode = 1;
});
