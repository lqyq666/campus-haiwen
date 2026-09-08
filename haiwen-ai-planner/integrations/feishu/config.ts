import { FeishuError } from "./errors";

export type FeishuConfig = {
  appId: string;
  appSecret: string;
  appToken: string;
  enabled: boolean;
  eventsTableId: string;
  leadsTableId: string;
  notifyEnabled: boolean;
  notifyReceiveId?: string;
  notifyReceiveIdType?: string;
  timeoutMs: number;
};

export function getFeishuConfig(
  environment: Record<string, string | undefined> = process.env
): FeishuConfig {
  const enabled = environment.FEISHU_ENABLED === "true";
  const config: FeishuConfig = {
    appId: environment.FEISHU_APP_ID ?? "",
    appSecret: environment.FEISHU_APP_SECRET ?? "",
    appToken: environment.FEISHU_BITABLE_APP_TOKEN ?? "",
    enabled,
    eventsTableId: environment.FEISHU_EVENTS_TABLE_ID ?? "",
    leadsTableId: environment.FEISHU_LEADS_TABLE_ID ?? "",
    notifyEnabled: environment.FEISHU_NOTIFY_ENABLED === "true",
    notifyReceiveId: environment.FEISHU_NOTIFY_RECEIVE_ID,
    notifyReceiveIdType: environment.FEISHU_NOTIFY_RECEIVE_ID_TYPE,
    timeoutMs: 8000,
  };
  if (
    enabled &&
    (!config.appId ||
      !config.appSecret ||
      !config.appToken ||
      !config.leadsTableId ||
      !config.eventsTableId)
  ) {
    throw new FeishuError(
      "FEISHU_CONFIG_INVALID",
      "Feishu CRM configuration is incomplete"
    );
  }
  if (
    config.notifyEnabled &&
    (!config.notifyReceiveId || !config.notifyReceiveIdType)
  ) {
    throw new FeishuError(
      "FEISHU_CONFIG_INVALID",
      "Feishu notification recipient is incomplete"
    );
  }
  return config;
}
