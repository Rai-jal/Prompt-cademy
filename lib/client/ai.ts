'use client';

import { supabase } from '@/lib/supabase';
import type { ModelConfig, PromptResult } from '@/types/ai';

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || null;
}

async function callAiRunEndpoint(payload: {
  prompt: string;
  modelKeys: string[];
  config?: ModelConfig;
}): Promise<PromptResult[]> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('You need to be signed in to run AI models.');
  }

  const response = await fetch('/api/ai/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to run AI request.');
  }

  return data.results as PromptResult[];
}

export async function runPromptViaApi(
  prompt: string,
  modelKey: string,
  config: ModelConfig = {}
): Promise<PromptResult> {
  const results = await callAiRunEndpoint({
    prompt,
    modelKeys: [modelKey],
    config,
  });
  const result = results[0];
  if (!result) {
    throw new Error('No response received from AI model.');
  }
  return result;
}

export function compareModelsViaApi(
  prompt: string,
  modelKeys: string[],
  config: ModelConfig = {}
): Promise<PromptResult[]> {
  return callAiRunEndpoint({
    prompt,
    modelKeys,
    config,
  });
}

