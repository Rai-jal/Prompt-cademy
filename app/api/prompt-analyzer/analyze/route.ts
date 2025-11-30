import { NextResponse } from 'next/server';

import { analyzePrompt } from '@/lib/prompt-improvement-service';

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';

    if (!trimmedPrompt) {
      return NextResponse.json(
        { error: 'Prompt is required for analysis.' },
        { status: 400 }
      );
    }

    const analysis = await analyzePrompt(trimmedPrompt);
    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('AI Analyzer - analyze error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to analyze prompt.' },
      { status: 500 }
    );
  }
}

