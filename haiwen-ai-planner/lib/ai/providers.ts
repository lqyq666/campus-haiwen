import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { createLanguageModel } from "./provider";

const testProvider = isTestEnvironment
  ? (() => {
      const {
        chatModel,
        titleModel: mockTitleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": mockTitleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(_modelId: string) {
  if (testProvider) {
    return testProvider.languageModel("chat-model");
  }
  return createLanguageModel();
}

export function getTitleModel() {
  if (testProvider) {
    return testProvider.languageModel("title-model");
  }
  return createLanguageModel();
}
