import { FeishuTokenProvider } from "./auth";
import { FeishuClient } from "./client";
import { getFeishuConfig } from "./config";
import { LeadCrmSyncService } from "./sync-service";
import type { FeishuLeadSyncRepository } from "./types";

export function syncRuntimeLead(
  leadId: string,
  repository: FeishuLeadSyncRepository
) {
  try {
    const config = getFeishuConfig();
    if (!config.enabled) {
      return Promise.resolve(undefined);
    }
    const tokens = new FeishuTokenProvider(config.appId, config.appSecret);
    const client = new FeishuClient(config.appToken, tokens, config.timeoutMs);
    return new LeadCrmSyncService(repository, client, config).syncLead(leadId);
  } catch (error) {
    return repository
      .saveSyncState({
        lastError:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "FEISHU_CONFIG_INVALID",
        leadId,
        notificationStatus: "PENDING",
        syncStatus: "FAILED",
        updatedAt: new Date().toISOString(),
      })
      .then(() => undefined);
  }
}

export * from "./config";
export * from "./errors";
export * from "./lead-mapper";
export * from "./sync-service";
export * from "./types";
