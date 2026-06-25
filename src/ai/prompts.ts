import { AIRequest, ExecutionContext } from './types';

interface PromptTemplate {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}

export function buildPrompt(request: AIRequest): PromptTemplate {
  if (request.feature === 'chat') {
    const teachingMode = request.teachingMode || 'beginner';
    const selectedItem = request.selectedItem;
    
    let modeInstruction = '';
    if (teachingMode === 'beginner') {
      modeInstruction = 'Explain concepts using simple everyday analogies, keep formatting clean, and avoid advanced programming jargon.';
    } else if (teachingMode === 'intermediate') {
      modeInstruction = 'Explain using clear programming concepts, types, and control flow. Be direct and clear.';
    } else if (teachingMode === 'advanced') {
      modeInstruction = 'Explain details about memory usage (stack vs heap), performance (Big O), and lower-level language semantics.';
    } else if (teachingMode === 'interview') {
      modeInstruction = 'Respond like an interviewer. Ask guiding questions, point out edge cases, and challenge the student to think about complexity.';
    } else if (teachingMode === 'debug') {
      modeInstruction = 'Focus on tracing current variable states, call stack frame structures, and finding the root cause of logical bugs.';
    }

    const system = `You are a patient, expert programming mentor and teacher.
Your goal is to help the student understand programming concepts, clear their doubts, and debug their code.
Rules:
- Act as a mentor, NOT a trace narrator. Do not just restate the execution trace or step descriptions unless asked.
- Answer user queries about the code, recursion, complexity, or language semantics.
- Current Teaching Mode is: ${teachingMode.toUpperCase()}. ${modeInstruction}
- Be concise but helpful. Use markdown formatting (bold, lists, code snippets) where appropriate.
- Refer to the selected item if provided by the user context.`;

    const contextBlock = buildContextBlock(request.context, request.language);
    
    let selectionInfo = '';
    if (selectedItem) {
      selectionInfo = `Selected Item in UI: ${selectedItem.type.toUpperCase()} "${selectedItem.name}" ${selectedItem.details ? `(${selectedItem.details})` : ''}\n`;
    }

    const historyStr = request.chatHistory
      ?.map(m => `${m.role === 'user' ? 'User' : 'Mentor'}: ${m.content}`)
      .join('\n') || '';

    const user = `${contextBlock}
${selectionInfo}
Code being visualised:
\`\`\`${request.language}
${request.context.code}
\`\`\`

Conversation History:
${historyStr}

User Query: ${request.userMessage}`;

    return {
      system,
      user,
      maxTokens: 300,
      temperature: 0.6
    };
  }


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
