import { describe, expect, it } from "vitest";
import { loadLLMConfig } from "./provider";

describe("loadLLMConfig", () => {
  it("accepts a complete OpenAI-compatible configuration", () => {
    expect(
      loadLLMConfig({
        LLM_API_KEY: "test-key",
        LLM_BASE_URL: "https://llm.example.com/v1",
        LLM_MODEL: "test-model",
        LLM_PROVIDER: "openai-compatible",
      })
    ).toEqual({
      apiKey: "test-key",
      baseURL: "https://llm.example.com/v1",
      model: "test-model",
      provider: "openai-compatible",
    });
  });

  it("rejects an incomplete configuration", () => {
    expect(() => loadLLMConfig({})).toThrow();
  });
});
