import { ExecutionOperation, Variable, StackFrame, ExecutionError, SupportedLanguage, ExecutionStep } from '../engine/types';

export interface AIRequest {
  feature: 'explain_step' | 'explain_error' | 'hint' | 'quiz' | 'explain_batch' | 'chat';
  context: ExecutionContext;
  userMessage?: string;      // Optional user follow-up
  language: SupportedLanguage;
  trace?: ExecutionStep[];
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
  selectedItem?: { name: string; type: 'variable' | 'array_element' | 'frame'; details?: string } | null;
  teachingMode?: 'beginner' | 'intermediate' | 'advanced' | 'interview' | 'debug';
}

export interface ExecutionContext {
  code: string;
  lineNumber: number;
  operation: ExecutionOperation;
  variables: Variable[];
  callStack: StackFrame[];
  stdout: string;
  stderr?: string;
  error?: ExecutionError;
}

export interface AIResponse {
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedNextSteps?: string[];
  relatedConcepts?: string[];
  generatedAt: string;
  provider: string;          // Which provider generated this
  model: string;             // Which model was used
  latencyMs: number;
}

export interface AIProviderConfig {
  name: AIProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  enabledFeatures: AIFeature[];
}

export type AIProvider = 'ollama' | 'openai' | 'gemini' | 'anthropic' | 'custom';
export type AIFeature = 'explain_step' | 'explain_error' | 'hint' | 'quiz' | 'explain_batch' | 'chat';

export interface AIProviderAdapter {
  readonly name: AIProvider;
  generate(request: AIRequest): Promise<AIResponse>;
  healthCheck(): Promise<boolean>;
  getModelInfo(): Promise<{ name: string; contextLength: number; capabilities: AIFeature[] }>;
}
