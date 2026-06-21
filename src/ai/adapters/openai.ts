import OpenAI from 'openai';
import { AIProviderAdapter, AIRequest, AIResponse, AIProviderConfig, AIFeature } from '../types';
import { buildPrompt } from '../prompts';

export class OpenAIAdapter implements AIProviderAdapter {
  readonly name = 'openai' as const;
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey || 'mock-key',
      baseURL: config.baseUrl, // For OpenAI-compatible endpoints
      timeout: config.timeoutMs
    });
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const prompt = buildPrompt(request);
    
    const completion = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      max_tokens: prompt.maxTokens,
      temperature: prompt.temperature,
      top_p: 0.8
    });

    return {
      explanation: completion.choices[0].message.content?.trim() || '',
      confidence: completion.choices[0].finish_reason === 'stop' ? 'high' : 'medium',
      generatedAt: new Date().toISOString(),
      provider: this.name,
      model: this.config.model,
      latencyMs: Date.now() - startTime
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Just check models list
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async getModelInfo() {
    return {
      name: this.config.model,
      contextLength: 128000,
      capabilities: ['explain_step', 'explain_error', 'hint', 'quiz'] as AIFeature[]
    };
  }
}
