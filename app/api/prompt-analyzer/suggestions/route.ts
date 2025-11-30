import { NextResponse } from 'next/server';

import { generatePromptSuggestions } from '@/lib/prompt-improvement-service';

export async function POST(request: Request) {
  try {
    const { goal, context } = await request.json();
    const trimmedGoal = typeof goal === 'string' ? goal.trim() : '';

    if (!trimmedGoal) {
      return NextResponse.json(
        { error: 'Goal is required to generate suggestions.' },
        { status: 400 }
      );
    }

    const suggestions = await generatePromptSuggestions(trimmedGoal, context);
    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('AI Analyzer - suggestion error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate suggestions.' },
      { status: 500 }
    );
  }
}

