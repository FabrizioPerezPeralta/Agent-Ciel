import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ModelSpec } from "./model.types";

export type ModelProvider = "ollama" | "openai-compatible";

export type ProviderSettings = {
  provider: ModelProvider;
  ollamaUrl: string;
  ollamaModel: string;
  openaiBaseUrl: string;
  openaiModel: string;
  hasApiKey: boolean;
  credentialStoreError: string | null;
};

export type ProviderSettingsDraft = Omit<ProviderSettings, "hasApiKey" | "credentialStoreError">;

export const defaultProviderSettings: ProviderSettings = {
  provider: "ollama",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "qwen2.5:7b",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiModel: "gpt-4o-mini",
  hasApiKey: false,
  credentialStoreError: null,
};

export function getProviderSettings() {
  return invoke<ProviderSettings>("get_provider_settings");
}

export function saveProviderSettings(settings: ProviderSettingsDraft, apiKey: string) {
  return invoke<ProviderSettings>("save_provider_settings", {
    settings,
    apiKey: apiKey.trim() ? apiKey : null,
  });
}

export function clearApiKey() {
  return invoke<void>("clear_api_key");
}

export function generateModelWithProvider(prompt: string, currentModel: ModelSpec) {
  return invoke<ModelSpec>("generate_model", { prompt, currentModel });
}

export { isTauri };
