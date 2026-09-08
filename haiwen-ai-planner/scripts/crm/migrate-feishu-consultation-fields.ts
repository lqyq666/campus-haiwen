import { config as loadEnvironment } from "dotenv";
import { FeishuTokenProvider } from "@/integrations/feishu/auth";
import { FeishuClient } from "@/integrations/feishu/client";
import { getFeishuConfig } from "@/integrations/feishu/config";
import { FEISHU_LEAD_FIELD_MAP } from "@/integrations/feishu/lead-mapper";
import { LeadCrmSyncService } from "@/integrations/feishu/sync-service";
import { getRuntimeSchoolDataRepositories } from "@/lib/repositories/school-data";

loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ quiet: true });

type FeishuEnvelope<T> = { code?: number; data?: T };
type FeishuField = { field_name: string };
type FeishuRecord = {
  fields: Record<string, unknown>;
  record_id: string;
};

const consultationFields = [
  FEISHU_LEAD_FIELD_MAP.qq,
  FEISHU_LEAD_FIELD_MAP.cet4,
  FEISHU_LEAD_FIELD_MAP.currentConcern,
  FEISHU_LEAD_FIELD_MAP.specificBlocker,
  FEISHU_LEAD_FIELD_MAP.decisionDeadline,
  FEISHU_LEAD_FIELD_MAP.attemptedAction,
  FEISHU_LEAD_FIELD_MAP.biggestWorry,
  FEISHU_LEAD_FIELD_MAP.advisorHelp,
  FEISHU_LEAD_FIELD_MAP.sevenDayAction,
  FEISHU_LEAD_FIELD_MAP.dailyStudyHours,
  FEISHU_LEAD_FIELD_MAP.riskPreference,
  FEISHU_LEAD_FIELD_MAP.requestedReview,
  FEISHU_LEAD_FIELD_MAP.next30DayGoal,
  FEISHU_LEAD_FIELD_MAP.recommendedOpening,
  FEISHU_LEAD_FIELD_MAP.whyContactNow,
  FEISHU_LEAD_FIELD_MAP.missingInformation,
  FEISHU_LEAD_FIELD_MAP.doNotPromise,
] as const;

function scalarText(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
}

async function main() {
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
    if (!response.ok || payload.code || !payload.data) {
      throw new Error("Feishu consultation field migration request failed");
    }
    return payload.data;
  };

  const basePath = `/bitable/v1/apps/${config.appToken}/tables/${config.leadsTableId}`;
  const fieldData = await request<{ items?: FeishuField[] }>(
    `${basePath}/fields?page_size=500`
  );
  const existingFields = new Set(
    (fieldData.items ?? []).map((field) => field.field_name)
  );
  let createdFields = 0;
  for (const fieldName of consultationFields) {
    if (existingFields.has(fieldName)) {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: schema changes are bounded and ordered.
    await request(`${basePath}/fields`, "POST", {
      field_name: fieldName,
      type: 1,
    });
    createdFields += 1;
  }

  const recordData = await request<{ items?: FeishuRecord[] }>(
    `${basePath}/records?page_size=500`
  );
  const records = recordData.items ?? [];
  const repositories = getRuntimeSchoolDataRepositories();
  let syncedRecords = 0;
  try {
    const client = new FeishuClient(config.appToken, tokens, config.timeoutMs);
    const service = new LeadCrmSyncService(
      repositories.leadRepository,
      client,
      config
    );
    for (const record of records) {
      const leadId = scalarText(record.fields[FEISHU_LEAD_FIELD_MAP.leadId]);
      if (leadId) {
        // biome-ignore lint/performance/noAwaitInLoops: CRM resync is bounded and preserves record order.
        const result = await service.syncLead(leadId);
        if (result?.syncStatus === "SYNCED") {
          syncedRecords += 1;
        }
      }
    }
  } finally {
    await repositories.close();
  }
  process.stdout.write(
    `${JSON.stringify({ createdFields, inspectedRecords: records.length, syncedRecords })}\n`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Feishu field migration failed"}\n`
  );
  process.exitCode = 1;
});
