export const DEFAULT_CHAT_MODEL = "configured-model";

export const titleModel = {
  description: "Configured model for title generation",
  id: DEFAULT_CHAT_MODEL,
  name: "Configured model",
  provider: "openai-compatible",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [titleModel];

const defaultCapabilities: ModelCapabilities = {
  reasoning: false,
  tools: true,
  vision: false,
};

export function getCapabilities(): Record<string, ModelCapabilities> {
  return { [DEFAULT_CHAT_MODEL]: defaultCapabilities };
}

export const isDemo = process.env.IS_DEMO === "1";

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((model) => model.id));

export const modelsByProvider = chatModels.reduce(
  (models, model) => {
    const providerModels = models[model.provider] ?? [];
    providerModels.push(model);
    models[model.provider] = providerModels;
    return models;
  },
  {} as Record<string, ChatModel[]>
);
