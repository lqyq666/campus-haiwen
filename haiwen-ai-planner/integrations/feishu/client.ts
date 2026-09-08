import type { FeishuTokenProvider } from "./auth";
import { FeishuError } from "./errors";
import type { FeishuApi, FeishuRecord } from "./types";

type FeishuResponse<T> = { code?: number; data?: T; msg?: string };
export class FeishuClient implements FeishuApi {
  private readonly appToken: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly tokens: FeishuTokenProvider;
  constructor(
    appToken: string,
    tokens: FeishuTokenProvider,
    timeoutMs: number,
    fetcher: typeof fetch = fetch
  ) {
    this.appToken = appToken;
    this.tokens = tokens;
    this.timeoutMs = timeoutMs;
    this.fetcher = fetcher;
  }

  async createRecord(
    tableId: string,
    fields: Record<string, unknown>
  ): Promise<FeishuRecord> {
    const data = await this.request<{
      record: { fields: Record<string, unknown>; record_id: string };
    }>(`/bitable/v1/apps/${this.appToken}/tables/${tableId}/records`, "POST", {
      fields,
    });
    return { fields: data.record.fields, recordId: data.record.record_id };
  }
  async updateRecord(
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    await this.request(
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/${recordId}`,
      "PUT",
      { fields }
    );
  }
  async findRecordByField(
    tableId: string,
    field: string,
    value: string
  ): Promise<FeishuRecord | undefined> {
    const filter = encodeURIComponent(
      `CurrentValue.[${field}] = "${value.replaceAll('"', '\\"')}"`
    );
    const data = await this.request<{
      items?: { fields: Record<string, unknown>; record_id: string }[];
    }>(
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records?filter=${filter}`,
      "GET"
    );
    const record = data.items?.[0];
    return record
      ? { fields: record.fields, recordId: record.record_id }
      : undefined;
  }
  async sendMessage(
    receiveId: string,
    receiveIdType: string,
    content: string
  ): Promise<void> {
    await this.request(
      `/im/v1/messages?receive_id_type=${encodeURIComponent(receiveIdType)}`,
      "POST",
      {
        content: JSON.stringify({ text: content }),
        msg_type: "text",
        receive_id: receiveId,
      }
    );
  }
  private async request<T>(
    path: string,
    method: string,
    body?: unknown
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        // biome-ignore lint/performance/noAwaitInLoops: retry attempts must be sequential and bounded.
        const token = await this.tokens.getToken();
        const response = await this.fetcher(
          `https://open.feishu.cn/open-apis${path}`,
          {
            body: body ? JSON.stringify(body) : undefined,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            method,
            signal: controller.signal,
          }
        );
        const payload = (await response.json()) as FeishuResponse<T>;
        if (response.ok && !payload.code) {
          return payload.data as T;
        }
        if (
          !(response.status === 429 || response.status >= 500) ||
          attempt === 1
        ) {
          throw new FeishuError(
            "FEISHU_REQUEST_FAILED",
            "Feishu request failed"
          );
        }
      } catch (error) {
        lastError = error;
        if (error instanceof FeishuError || attempt === 1) {
          break;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    if (lastError instanceof DOMException && lastError.name === "AbortError") {
      throw new FeishuError(
        "FEISHU_REQUEST_TIMEOUT",
        "Feishu request timed out"
      );
    }
    if (lastError instanceof FeishuError) {
      throw lastError;
    }
    throw new FeishuError("FEISHU_REQUEST_FAILED", "Feishu request failed");
  }
}
