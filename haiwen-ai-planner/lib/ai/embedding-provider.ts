import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { type EmbeddingModel, embedMany } from "ai";
import { z } from "zod";

const schema = z.object({
  apiKey: z.string().min(1),
  baseURL: z.url(),
  dimensions: z.coerce.number().int().positive().optional(),
  model: z.string().min(1),
  provider: z.literal("openai-compatible"),
});

export type EmbeddingConfig = z.infer<typeof schema>;
export type EmbeddingProvider = {
  embed: (values: string[]) => Promise<number[][]>;
  model: string;
};

export function loadEmbeddingConfig(
  env: Record<string, string | undefined> = process.env
): EmbeddingConfig {
  return schema.parse({
    apiKey: env.EMBEDDING_API_KEY,
    baseURL: env.EMBEDDING_BASE_URL,
    dimensions: env.EMBEDDING_DIMENSIONS,
    model: env.EMBEDDING_MODEL,
    provider: env.EMBEDDING_PROVIDER,
  });
}

export function createEmbeddingModel(
  config = loadEmbeddingConfig()
): EmbeddingProvider {
  const provider = createOpenAICompatible({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    name: config.provider,
  });
  const model = provider.embeddingModel(config.model) as EmbeddingModel;
  return {
    embed: async (values) => {
      const result = await embedMany({
        model,
        values,
        ...(config.dimensions
          ? { providerOptions: { openai: { dimensions: config.dimensions } } }
          : {}),
      });
      return result.embeddings;
    },
    model: config.model,
  };
}

export function createFakeEmbeddingProvider(
  model = "fake-embedding-v1"
): EmbeddingProvider {
  return {
    embed: async (values) => values.map(deterministicVector),
    model,
  };
}

function deterministicVector(value: string) {
  const vector = [0, 0, 0, 0];
  for (const [index, char] of [...value].entries()) {
    vector[index % vector.length] += char.codePointAt(0) ?? 0;
  }
  const magnitude = Math.hypot(...vector) || 1;
  return vector.map((item) => Number((item / magnitude).toFixed(6)));
}
