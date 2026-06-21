import { NextRequest, NextResponse } from 'next/server';
import { generateExplanation, generateErrorHelp, generateHint, generateQuiz } from '../../../../ai/service';
import { AIRequest, AIFeature } from '../../../../ai/types';

const HANDLERS: Record<AIFeature, typeof generateExplanation> = {
  explain_step: generateExplanation,
  explain_error: generateErrorHelp,
  hint: generateHint,
  quiz: generateQuiz
};

export async function POST(req: NextRequest) {
  try {
    const request: AIRequest = await req.json();
    const handler = HANDLERS[request.feature];
    
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
