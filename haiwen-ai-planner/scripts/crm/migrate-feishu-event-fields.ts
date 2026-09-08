import { config as loadEnvironment } from "dotenv";
import { FeishuTokenProvider } from "@/integrations/feishu/auth";
import { getFeishuConfig } from "@/integrations/feishu/config";

loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ quiet: true });

type FeishuEnvelope<T> = { code?: number; data?: T };
type FeishuField = { field_id: string; field_name: string; type: number };
type FeishuRecord = {
  fields: Record<string, unknown>;
  record_id: string;
};

const fieldRenames = new Map([
  ["Event ID", "事件编号"],
  ["Event Key", "事件唯一键"],
  ["Lead ID", "线索编号"],
  ["Event Type", "事件类型"],
  ["Occurred At", "发生时间"],
  ["Metadata", "事件详情"],
]);

const eventTypeLabels = new Map([
  ["AI_REPORT_GENERATED", "智能报告已生成"],
  ["ASSESSMENT_COMPLETED", "测评已完成"],
  ["ASSESSMENT_STARTED", "测评已开始"],
  ["CHAT_MESSAGE_SENT", "咨询消息已发送"],
  ["CHAT_STARTED", "咨询已开始"],
  ["CONTACT_SUBMITTED", "联系方式已提交"],
  ["EVIDENCE_VIEWED", "官方依据已查看"],
  ["REPORT_VIEWED", "报告已查看"],
  ["REQUESTED_CONSULTATION", "已申请老师咨询"],
  ["RETURN_VISIT", "再次访问"],
  ["ROADMAP_VIEWED", "行动计划已查看"],
  ["SCHOOL_RECOMMENDATION_VIEWED", "院校建议已查看"],
]);

async function main() {
  const apply = process.argv.includes("--apply");
  const config = getFeishuConfig();
  if (!config.enabled) {
    throw new Error(
      "FEISHU_ENABLED must be true before migrating event fields"
    );
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
      throw new Error("Feishu event field migration request failed");
    }
    return payload.data;
  };

  const basePath = `/bitable/v1/apps/${config.appToken}/tables/${config.eventsTableId}`;
  const fieldData = await request<{ items?: FeishuField[] }>(
    `${basePath}/fields?page_size=500`
  );
  const fields = fieldData?.items ?? [];
  const fieldsByName = new Map(
    fields.map((field) => [field.field_name, field])
  );
  const renamePlan = [...fieldRenames]
    .map(([from, to]) => ({ field: fieldsByName.get(from), from, to }))
    .filter((item): item is { field: FeishuField; from: string; to: string } =>
      Boolean(item.field)
    );

  const recordData = await request<{ items?: FeishuRecord[] }>(
    `${basePath}/records?page_size=500`
  );
  const records = recordData?.items ?? [];
  const currentTypeField = fieldsByName.has("Event Type")
    ? "Event Type"
    : "事件类型";
  const valuePlan = records.flatMap((record) => {
    const current = record.fields[currentTypeField];
    const translated =
      typeof current === "string" ? eventTypeLabels.get(current) : undefined;
    return translated
      ? [{ from: current, recordId: record.record_id, to: translated }]
      : [];
  });

  if (apply) {
    for (const item of valuePlan) {
      // biome-ignore lint/performance/noAwaitInLoops: bounded production migration.
      await request(`${basePath}/records/${item.recordId}`, "PUT", {
        fields: { [currentTypeField]: item.to },
      });
    }
    for (const { field, to } of renamePlan) {
      // biome-ignore lint/performance/noAwaitInLoops: ordered schema migration.
      await request(`${basePath}/fields/${field.field_id}`, "PUT", {
        field_name: to,
        type: field.type,
      });
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      apply,
      inspectedRecords: records.length,
      renamed: renamePlan.map(({ from, to }) => `${from} -> ${to}`),
      translatedEventTypes: valuePlan.length,
    })}\n`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Feishu event field migration failed"}\n`
  );
  process.exitCode = 1;
});
