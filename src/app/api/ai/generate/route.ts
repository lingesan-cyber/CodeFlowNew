import { NextRequest, NextResponse } from 'next/server';
import { generateExplanation, generateErrorHelp, generateHint, generateQuiz, generateChatResponse, getCurrentProvider, getCurrentModel } from '../../../../ai/service';
import { AIRequest, AIFeature } from '../../../../ai/types';

const HANDLERS: Record<Exclude<AIFeature, 'explain_batch'>, typeof generateExplanation> = {
  explain_step: generateExplanation,
  explain_error: generateErrorHelp,
  hint: generateHint,
  quiz: generateQuiz,
  chat: generateChatResponse
};

export async function POST(req: NextRequest) {
  try {
    const request: AIRequest = await req.json();
    const provider = getCurrentProvider();
    const model = getCurrentModel();

    console.log("=== REQUEST RECEIVED ===");
    console.log(request.feature);
    console.log(provider);
    console.log(model);
    console.log("========================");

    const handler = (HANDLERS as Record<string, typeof generateExplanation>)[request.feature];
    
    if (!handler) {
      return NextResponse.json({ error: 'Unknown feature' }, { status: 400 });
    }

    const response = await handler(request);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: 'AI generation failed', message: (error as Error).message },
      { status: 503 }
    );
  }
}
