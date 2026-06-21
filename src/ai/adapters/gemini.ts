import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProviderAdapter, AIRequest, AIResponse, AIProviderConfig, AIFeature } from '../types';
import { buildPrompt } from '../prompts';

export class GeminiAdapter implements AIProviderAdapter {
  readonly name = 'gemini' as const;
  private client: GoogleGenerativeAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new GoogleGenerativeAI(config.apiKey || 'mock-key');
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const prompt = buildPrompt(request);
    
    const model = this.client.getGenerativeModel({ 
      model: this.config.model,
      generationConfig: {
        maxOutputTokens: prompt.maxTokens,
        temperature: prompt.temperature,
        topP: 0.8
      }
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${prompt.system}\n\n${prompt.user}` }] }]
    });

    return {
      explanation: result.response.text().trim(),
      confidence: 'high',
      generatedAt: new Date().toISOString(),
      provider: this.name,
      model: this.config.model,
      latencyMs: Date.now() - startTime
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.config.model });
      await model.countTokens('test');
      return true;
    } catch {
      return false;
    }
  }

  async getModelInfo() {
    return {
      name: this.config.model,
      contextLength: 1000000,
      capabilities: ['explain_step', 'explain_error', 'hint', 'quiz'] as AIFeature[]
    };
  }
}
