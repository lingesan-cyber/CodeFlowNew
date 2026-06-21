import { NextResponse } from 'next/server';
import { checkAIHealth } from '../../../../ai/service';

export async function GET() {
  const health = await checkAIHealth();
  return NextResponse.json(health);
}
