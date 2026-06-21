import { AIRequest, ExecutionContext } from './types';

interface PromptTemplate {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}

export function buildPrompt(request: AIRequest): PromptTemplate {
  const baseSystem = `You are a patient programming tutor explaining code execution to a complete beginner.
Task: ${getTaskDescription(request.feature)}
Rules:
* Use analogies suitable for beginners (boxes, labels, containers).
* Avoid jargon. Define technical terms immediately if used.
* Focus on WHY and WHAT, not just mechanics.
* Maximum 50 words. Be concise.
* Plain text only. No markdown. No follow-up questions.`;

  const contextBlock = buildContextBlock(request.context, request.language);
  
  return {
    system: baseSystem,
    user: contextBlock,
    maxTokens: request.feature === 'quiz' ? 300 : 150,
    temperature: request.feature === 'hint' ? 0.5 : 0.3
  };
}

function getTaskDescription(feature: string): string {
  const tasks: Record<string, string> = {
    explain_step: 'Explain the current execution step in 1-2 simple sentences.',
    explain_error: 'Explain why this error occurred and how to fix it in simple terms.',
    hint: 'Give a subtle hint about what to do next without revealing the answer.',
    quiz: 'Generate a multiple-choice question to test understanding of this concept.'
  };
  return tasks[feature] || tasks.explain_step;
}

function buildContextBlock(ctx: ExecutionContext, lang: string): string {
  return `Language: ${lang}
Current line ${ctx.lineNumber}: ${ctx.code.split('\n')[ctx.lineNumber - 1]?.trim() || 'N/A'}
Operation: ${ctx.operation}
Variables: ${ctx.variables.map(v => `${v.name}=${JSON.stringify(v.value)}`).join(', ')}
Call stack: ${ctx.callStack.map(f => f.functionName).join(' > ') || 'main'}
${ctx.error ? `Error: ${ctx.error.message}` : ''}`;
}
