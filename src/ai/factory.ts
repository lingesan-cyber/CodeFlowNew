import { AIProvider, AIProviderAdapter, AIProviderConfig } from './types';
import { OllamaAdapter } from './adapters/ollama';
import { OpenAIAdapter } from './adapters/openai';
import { GeminiAdapter } from './adapters/gemini';

const ADAPTER_REGISTRY: Record<AIProvider, new (config: AIProviderConfig) => AIProviderAdapter> = {
  ollama: OllamaAdapter,
  openai: OpenAIAdapter,
  gemini: GeminiAdapter,
  anthropic: OpenAIAdapter, // Anthropic uses OpenAI-compatible API via baseURL (e.g. LiteLLM, Groq, etc.) or standard wrapper
  custom: OpenAIAdapter     // Custom OpenAI-compatible endpoint
};

export function createAdapter(provider: AIProvider, config: AIProviderConfig): AIProviderAdapter {
  const AdapterClass = ADAPTER_REGISTRY[provider];
  if (!AdapterClass) {
    throw new Error(`Unknown AI provider: ${provider}. Supported: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`);
  }
  return new AdapterClass(config);
}

export function getAvailableProviders(): AIProvider[] {
  return Object.keys(ADAPTER_REGISTRY) as AIProvider[];
}
