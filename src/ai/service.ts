import { createAdapter } from './factory';
import { 
  AIRequest, AIResponse, AIFeature, AIProvider, 
  AIProviderConfig
} from './types';
import { buildPrompt } from './prompts';

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
  const allFeatures: AIFeature[] = ['explain_step', 'explain_error', 'hint', 'quiz', 'explain_batch', 'chat'];
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
    const prompt = buildPrompt(request);
    console.log("=== AI PROMPT SENT (explain_step) ===");
    console.log("System:", prompt.system);
    console.log("User:", prompt.user);
    console.log("=====================================");

    const response = await getAdapter().generate(request);

    console.log("=== RAW AI RESPONSE (explain_step) ===");
    console.log(response.explanation);
    console.log("======================================");

    return response;
  } catch (e) {
    console.error("=== AI EXPLANATION ERROR (explain_step) ===");
    console.error(e);
    console.log("===========================================");
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

export async function generateBatchExplanations(request: AIRequest): Promise<AIResponse> {
  if (!isFeatureEnabled('explain_batch')) {
    return createFallbackResponse(request, 'AI batch explanations disabled');
  }
  try {
    const prompt = buildPrompt(request);
    console.log("=== AI PROMPT SENT (explain_batch) ===");
    console.log("System:", prompt.system);
    console.log("User:", prompt.user);
    console.log("======================================");

    const response = await getAdapter().generate({ ...request, feature: 'explain_batch' });

    console.log("=== RAW AI RESPONSE (explain_batch) ===");
    console.log(response.explanation);
    console.log("=======================================");

    return response;
  } catch (e) {
    console.error("=== AI EXPLANATION ERROR (explain_batch) ===");
    console.error(e);
    console.log("=============================================");
    return createFallbackResponse(request, e instanceof Error ? e.message : 'Unknown error');
  }
}

export async function generateChatResponse(request: AIRequest): Promise<AIResponse> {
  if (!isFeatureEnabled('chat')) {
    return createFallbackResponse(request, 'AI chat tutor disabled');
  }
  try {
    return await getAdapter().generate({ ...request, feature: 'chat' });
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
  if (request.feature === 'explain_batch') {
    const trace = request.trace || [];
    const explanations = trace.map(() => '[AI unavailable]');
    return {
      explanation: JSON.stringify(explanations),
      confidence: 'low',
      generatedAt: new Date().toISOString(),
      provider: 'fallback',
      model: 'none',
      latencyMs: 0
    };
  }

  const fallbacks: Record<Exclude<AIFeature, 'explain_batch'>, string> = {
    explain_step: '[AI unavailable]',
    explain_error: `Error occurred: ${request.context.error?.message || 'Unknown error'}`,
    hint: 'Try tracing the variables step by step.',
    quiz: 'What will be the value of the main variable after this step?',
    chat: 'I am here to help. Could you try checking the variables state or asking another question?'
  };

  return {
    explanation: fallbacks[request.feature as Exclude<AIFeature, 'explain_batch'>] || `Fallback: ${reason}`,
    confidence: 'low',
    generatedAt: new Date().toISOString(),
    provider: 'fallback',
    model: 'none',
    latencyMs: 0
  };
}
