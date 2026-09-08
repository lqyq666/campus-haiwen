export type FeishuErrorCode =
  | "FEISHU_AUTH_FAILED"
  | "FEISHU_CONFIG_INVALID"
  | "FEISHU_REQUEST_FAILED"
  | "FEISHU_REQUEST_TIMEOUT";

export class FeishuError extends Error {
  readonly code: FeishuErrorCode;
  constructor(code: FeishuErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}
