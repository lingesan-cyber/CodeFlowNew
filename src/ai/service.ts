import { createAdapter } from './factory';
import { 
  AIRequest, AIResponse, AIFeature, AIProvider, 
  AIProviderConfig
} from './types';

// Load config from environment variables once
function loadConfig(): AIProviderConfig {
  // Safe environment parsing
  const provider = (process.env.AI_PROVIDER || 'ollama') as AIProvider;
  const model = process.env.AI_MODEL || 'qwen2.5-coder:7b';
  const baseUrl = process.env.AI_BASE_URL || 'http://localhost:11434';
  const apiKey = process.env.AI_API_KEY;
  const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '10000', 10);
  const maxTokens = parseInt(process.env.AI_MAX_TOKENS || '150', 10);
  const temperature = parseFloat(process.env.AI_TEMPERATURE || '0.3');

  // Parse enabled features
  const allFeatures: AIFeature[] = ['explain_step', 'explain_error', 'hint', 'quiz'];
  const enabledFeatures = allFeatures.filter(f => 
    process.env[`AI_ENABLE_${f.toUpperCase()}`] !== 'false'
  );

  return { name: provider, model, baseUrl, apiKey, timeoutMs, maxTokens, temperature, enabledFeatures };
}

// Singleton instance
let adapter: ReturnType<typeof createAdapter> | null = null;
let config: AIProviderConfig | null = null;

function getAdapter() {
  if (!adapter) {
    config = loadConfig();
    adapter = createAdapter(config.name, config);
  }
  return adapter;
}

// PUBLIC API — All AI features call these functions only

export async function generateExplanation(request: AIRequest): Promise<AIResponse> {
  if (!isFeatureEnabled('explain_step')) {
    return createFallbackResponse(request, 'AI explanations disabled');
  }
  try {
    return await getAdapter().generate(request);
  } catch (e) {
    return createFallbackResponse(request, e instanceof Error ? e.message : 'Unknown error');
  }
}

export async function generateErrorHelp(request: AIRequest): Promise<AIResponse> {
  if (!isFeatureEnabled('explain_error')) {
    return createFallbackResponse(request, 'AI error help disabled');
  }
  try {
    return await getAdapter().generate({ ...request, feature: 'explain_error' });
  } catch (e) {
    return createFallbackResponse(request, e instanceof Error ? e.message : 'Unknown error');
  }
}

export async function generateHint(request: AIRequest): Promise<AIResponse> {
  if (!isFeatureEnabled('hint')) {
    return createFallbackResponse(request, 'AI hints disabled');
  }
  try {
    return await getAdapter().generate({ ...request, feature: 'hint' });
  } catch (e) {
    return createFallbackResponse(request, e instanceof Error ? e.message : 'Unknown error');
  }
}

export async function generateQuiz(request: AIRequest): Promise<AIResponse> {
  if (!isFeatureEnabled('quiz')) {
    return createFallbackResponse(request, 'AI quizzes disabled');
  }
  try {
    return await getAdapter().generate({ ...request, feature: 'quiz' });
  } catch (e) {
    return createFallbackResponse(request, e instanceof Error ? e.message : 'Unknown error');
  }
}

export async function checkAIHealth(): Promise<{ available: boolean; provider: string; model: string }> {
  try {
    const activeAdapter = getAdapter();
    const healthy = await activeAdapter.healthCheck();
    const info = await activeAdapter.getModelInfo();
    return { available: healthy, provider: activeAdapter.name, model: info.name };
  } catch {
    return { available: false, provider: config?.name || 'unknown', model: config?.model || 'unknown' };
  }
}

export function getCurrentProvider(): AIProvider {
  return (config || loadConfig()).name;
}

export function isFeatureEnabled(feature: AIFeature): boolean {
  const cfg = config || loadConfig();
  return cfg.enabledFeatures.includes(feature);
}

// Fallback when AI is unavailable
function createFallbackResponse(request: AIRequest, reason: string): AIResponse {
  const fallbacks: Record<AIFeature, string> = {
    explain_step: `The program is executing: ${request.context.operation} at line ${request.context.lineNumber}.`,
    explain_error: `Error occurred: ${request.context.error?.message || 'Unknown error'}`,
    hint: 'Try tracing the variables step by step.',
    quiz: 'What will be the value of the main variable after this step?'
  };

  return {
    explanation: fallbacks[request.feature] || `Fallback: ${reason}`,
    confidence: 'low',
    generatedAt: new Date().toISOString(),
    provider: 'fallback',
    model: 'none',
    latencyMs: 0
  };
}
