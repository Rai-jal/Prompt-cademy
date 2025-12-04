'use server';

import 'server-only';

import { AI_MODELS, type AIProvider } from '@/lib/ai-models';
import type { ModelConfig, PromptResult } from '@/types/ai';

type ProviderKeyMap = Partial<Record<AIProvider, string | undefined>>;

const MAX_CONCURRENT_REQUESTS = 2;
const RATE_LIMIT_DELAY_MS = 350;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const FALLBACK_PROVIDER_KEYS: ProviderKeyMap = {
  openai: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
};

const resolveProviderKey = (
  provider: AIProvider,
  providerKeys: ProviderKeyMap
): string | null => {
  return providerKeys[provider] || FALLBACK_PROVIDER_KEYS[provider] || null;
};

async function buildProviderError(response: Response, providerLabel: string) {
  let errorBody: any = {};
  try {
    errorBody = await response.json();
  } catch {
    // swallow parse error
  }

  if (response.status === 429) {
    throw new Error(
      `${providerLabel} rate limit reached. Please wait a moment or reduce the number of simultaneous models.`
    );
  }

  const message =
    errorBody.error?.message ||
    errorBody.message ||
    `Failed to get response from ${providerLabel}`;

  throw new Error(message);
}

async function runOpenAI(
  prompt: string,
  modelId: string,
  config: ModelConfig,
  apiKey: string
): Promise<PromptResult> {
  const startTime = Date.now();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature ?? 0.7,
      max_tokens: config.max_tokens ?? 1000,
      top_p: config.top_p,
      frequency_penalty: config.frequency_penalty,
      presence_penalty: config.presence_penalty,
    }),
  });

  if (!response.ok) {
    await buildProviderError(response, 'OpenAI');
  }

  const data = await response.json();
  const duration_ms = Date.now() - startTime;

  const input_tokens = data.usage.prompt_tokens;
  const output_tokens = data.usage.completion_tokens;
  const tokens_used = data.usage.total_tokens;

  const modelInfo = AI_MODELS[modelId] || AI_MODELS['gpt-4o'];
  const cost_estimate =
    (input_tokens / 1000) * modelInfo.costPer1kInput +
    (output_tokens / 1000) * modelInfo.costPer1kOutput;

  return {
    response: data.choices[0].message.content,
    tokens_used,
    input_tokens,
    output_tokens,
    duration_ms,
    cost_estimate,
    model: modelId,
    provider: 'openai',
  };
}

async function runAnthropic(
  prompt: string,
  modelId: string,
  config: ModelConfig,
  apiKey: string
): Promise<PromptResult> {
  const startTime = Date.now();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: config.max_tokens ?? 1000,
      temperature: config.temperature ?? 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    await buildProviderError(response, 'Anthropic');
  }

  const data = await response.json();
  const duration_ms = Date.now() - startTime;

  const input_tokens = data.usage.input_tokens;
  const output_tokens = data.usage.output_tokens;
  const tokens_used = input_tokens + output_tokens;

  const modelKey = Object.keys(AI_MODELS).find((key) => AI_MODELS[key].id === modelId);
  const modelInfo = modelKey ? AI_MODELS[modelKey] : AI_MODELS['claude-3-5-sonnet'];
  const cost_estimate =
    (input_tokens / 1000) * modelInfo.costPer1kInput +
    (output_tokens / 1000) * modelInfo.costPer1kOutput;

  return {
    response: data.content[0].text,
    tokens_used,
    input_tokens,
    output_tokens,
    duration_ms,
    cost_estimate,
    model: modelId,
    provider: 'anthropic',
  };
}

async function runGoogle(
  prompt: string,
  modelId: string,
  config: ModelConfig,
  apiKey: string
): Promise<PromptResult> {
  const startTime = Date.now();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          maxOutputTokens: config.max_tokens ?? 1000,
          topP: config.top_p,
        },
      }),
    }
  );

  if (!response.ok) {
    await buildProviderError(response, 'Google');
  }

  const data = await response.json();
  const duration_ms = Date.now() - startTime;

  const input_tokens = data.usageMetadata?.promptTokenCount || 0;
  const output_tokens = data.usageMetadata?.candidatesTokenCount || 0;
  const tokens_used = input_tokens + output_tokens;

  const modelKey = Object.keys(AI_MODELS).find((key) => AI_MODELS[key].id === modelId);
  const modelInfo = modelKey ? AI_MODELS[modelKey] : AI_MODELS['gemini-pro'];
  const cost_estimate =
    (input_tokens / 1000) * modelInfo.costPer1kInput +
    (output_tokens / 1000) * modelInfo.costPer1kOutput;

  return {
    response: data.candidates[0].content.parts[0].text,
    tokens_used,
    input_tokens,
    output_tokens,
    duration_ms,
    cost_estimate,
    model: modelId,
    provider: 'google',
  };
}

async function runModel(
  prompt: string,
  modelKey: string,
  config: ModelConfig,
  providerKeys: ProviderKeyMap
): Promise<PromptResult> {
  const modelInfo = AI_MODELS[modelKey];
  if (!modelInfo) {
    throw new Error(`Unknown model: ${modelKey}`);
  }

  const providerKey = resolveProviderKey(modelInfo.provider, providerKeys);
  if (!providerKey) {
    throw new Error(
      `Missing API key for ${modelInfo.provider}. Add a personal key in Settings or configure a server-side fallback.`
    );
  }

  switch (modelInfo.provider) {
    case 'openai':
      return runOpenAI(prompt, modelInfo.id, config, providerKey);
    case 'anthropic':
      return runAnthropic(prompt, modelInfo.id, config, providerKey);
    case 'google':
      return runGoogle(prompt, modelInfo.id, config, providerKey);
    default:
      throw new Error(`Unsupported provider: ${modelInfo.provider}`);
  }
}

export async function executeModelRuns({
  prompt,
  modelKeys,
  config = {},
  providerKeys = {},
}: {
  prompt: string;
  modelKeys: string[];
  config?: ModelConfig;
  providerKeys?: ProviderKeyMap;
}): Promise<PromptResult[]> {
  const aggregatedResults: PromptResult[] = [];

  for (let i = 0; i < modelKeys.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = modelKeys.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const batchResults = await Promise.allSettled(
      batch.map((modelKey) => runModel(prompt, modelKey, config, providerKeys))
    );

    batchResults.forEach((result, idx) => {
      const modelKey = batch[idx];
      const modelInfo = AI_MODELS[modelKey];

      if (result.status === 'fulfilled') {
        aggregatedResults.push(result.value);
      } else {
        const errorMessage = result.reason?.message || 'Unknown error';
        aggregatedResults.push({
          response: `Error: ${errorMessage}`,
          tokens_used: 0,
          input_tokens: 0,
          output_tokens: 0,
          duration_ms: 0,
          cost_estimate: 0,
          model: modelInfo?.id || modelKey,
          provider: modelInfo?.provider || 'openai',
          error: errorMessage,
        });
      }
    });

    if (i + MAX_CONCURRENT_REQUESTS < modelKeys.length) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  return aggregatedResults;
}

