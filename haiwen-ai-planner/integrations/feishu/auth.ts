import { FeishuError } from "./errors";

type TokenResponse = {
  code?: number;
  expire?: number;
  msg?: string;
  tenant_access_token?: string;
};
export class FeishuTokenProvider {
  private cached?: { expiresAt: number; token: string };
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  constructor(
    appId: string,
    appSecret: string,
    fetcher: typeof fetch = fetch,
    now: () => number = Date.now
  ) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.fetcher = fetcher;
    this.now = now;
  }

  async getToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt - 60_000 > this.now()) {
      return this.cached.token;
    }
    let response: Response;
    try {
      response = await this.fetcher(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          body: JSON.stringify({
            app_id: this.appId,
            app_secret: this.appSecret,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );
    } catch {
      // biome-ignore lint/style/useErrorCause: do not retain external authentication response details.
      throw new FeishuError(
        "FEISHU_AUTH_FAILED",
        "Unable to obtain Feishu access token"
      );
    }
    const body = (await response.json()) as TokenResponse;
    if (
      !response.ok ||
      body.code ||
      !body.tenant_access_token ||
      !body.expire
    ) {
      throw new FeishuError(
        "FEISHU_AUTH_FAILED",
        "Feishu access token request failed"
      );
    }
    this.cached = {
      expiresAt: this.now() + body.expire * 1000,
      token: body.tenant_access_token,
    };
    return this.cached.token;
  }
}
