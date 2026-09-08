import { FeishuTokenProvider } from "@/integrations/feishu/auth";
import { FeishuClient } from "@/integrations/feishu/client";
import { getFeishuConfig } from "@/integrations/feishu/config";
import { LeadCrmSyncService } from "@/integrations/feishu/sync-service";
import { getRuntimeSchoolDataRepositories } from "@/lib/repositories/school-data";

async function main() {
  const limitArgument = process.argv.find((value) =>
    value.startsWith("--limit=")
  );
  const limit = limitArgument ? Number(limitArgument.split("=")[1]) : 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error("--limit must be an integer from 1 to 200");
  }
  const config = getFeishuConfig();
  if (!config.enabled) {
    throw new Error("FEISHU_ENABLED must be true before retrying failed leads");
  }
  const repositories = getRuntimeSchoolDataRepositories();
  try {
    const tokens = new FeishuTokenProvider(config.appId, config.appSecret);
    const client = new FeishuClient(config.appToken, tokens, config.timeoutMs);
    const result = await new LeadCrmSyncService(
      repositories.leadRepository,
      client,
      config
    ).retryFailedLeads(limit);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.synced !== result.attempted) {
      process.exitCode = 1;
    }
  } finally {
    await repositories.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Feishu retry failed"}\n`
  );
  process.exitCode = 1;
});
