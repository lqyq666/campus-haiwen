import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

const llmConfigSchema = z.object({
  apiKey: z.string().min(1, "LLM_API_KEY is required"),
  baseURL: z.url("LLM_BASE_URL must be a valid URL"),
  model: z.string().min(1, "LLM_MODEL is required"),
  provider: z.literal("openai-compatible"),
});

export type LLMConfig = z.infer<typeof llmConfigSchema>;

export function loadLLMConfig(
  env: Record<string, string | undefined> = process.env
): LLMConfig {
  return llmConfigSchema.parse({
    apiKey: env.LLM_API_KEY,
    baseURL: env.LLM_BASE_URL,
    model: env.LLM_MODEL,
    provider: env.LLM_PROVIDER,
  });
}

export function createLanguageModel(config = loadLLMConfig()) {
  const provider = createOpenAICompatible({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    name: config.provider,
  });
  return provider.languageModel(config.model);
}
