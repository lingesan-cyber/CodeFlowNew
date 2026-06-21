import axios from 'axios';
import { AIProviderAdapter, AIRequest, AIResponse, AIProviderConfig, AIFeature } from '../types';
import { buildPrompt } from '../prompts';

export class OllamaAdapter implements AIProviderAdapter {
  readonly name = 'ollama' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const prompt = buildPrompt(request);
    
    const response = await axios.post(
      `${this.config.baseUrl}/api/generate`,
      {
        model: this.config.model,
        prompt: `${prompt.system}\n\n${prompt.user}\n\nExplanation:`,
        stream: false,
        options: {
          temperature: prompt.temperature,
          num_predict: prompt.maxTokens,
          top_p: 0.8,
          top_k: 20,
          repeat_penalty: 1.05,
          stop: ['\n\n', '###', 'User:', 'Assistant:']
        }
      },
      { timeout: this.config.timeoutMs }
    );

    return {
      explanation: response.data.response.trim(),
      confidence: 'high',
      generatedAt: new Date().toISOString(),
      provider: this.name,
      model: this.config.model,
      latencyMs: Date.now() - startTime
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await axios.get(`${this.config.baseUrl}/api/tags`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async getModelInfo() {
    return {
      name: this.config.model,
      contextLength: 32768,
      capabilities: ['explain_step', 'explain_error', 'hint', 'quiz'] as AIFeature[]
    };
  }
}
