export type AIProvider = 'openai' | 'anthropic' | 'google';

export type AIModel = {
  id: string;
  name: string;
  provider: AIProvider;
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  supportsImages: boolean;
};

const MAX_CONCURRENT_REQUESTS = 2;
const RATE_LIMIT_DELAY_MS = 350;

export const AI_MODELS: Record<string, AIModel> = {
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    costPer1kInput: 2.5,
    costPer1kOutput: 10,
    supportsImages: true,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    costPer1kInput: 0.15,
    costPer1kOutput: 0.6,
    supportsImages: true,
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextWindow: 128000,
    costPer1kInput: 10,
    costPer1kOutput: 30,
    supportsImages: true,
  },
  'claude-3-5-sonnet': {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kInput: 3,
    costPer1kOutput: 15,
    supportsImages: true,
  },
  'claude-3-5-haiku': {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kInput: 0.8,
    costPer1kOutput: 4,
    supportsImages: false,
  },
  'gemini-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    contextWindow: 2000000,
    costPer1kInput: 1.25,
    costPer1kOutput: 5,
    supportsImages: true,
  },
  'gemini-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    contextWindow: 1000000,
    costPer1kInput: 0.075,
    costPer1kOutput: 0.3,
    supportsImages: true,
  },
};

export type ModelConfig = {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
};

export type PromptResult = {
  response: string;
  tokens_used: number;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  cost_estimate: number;
  model: string;
  provider: AIProvider;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function buildProviderError(response: Response, providerLabel: string) {
  let errorBody: any = {};
  try {
    errorBody = await response.json();
  } catch (_) {
    // ignore body parsing errors
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
  config: ModelConfig
): Promise<PromptResult> {
  const startTime = Date.now();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
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
  config: ModelConfig
): Promise<PromptResult> {
  const startTime = Date.now();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '',
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
  config: ModelConfig
): Promise<PromptResult> {
  const startTime = Date.now();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}`,
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

export async function runPrompt(
  prompt: string,
  modelKey: string,
  config: ModelConfig = {}
): Promise<PromptResult> {
  const modelInfo = AI_MODELS[modelKey];
  if (!modelInfo) {
    throw new Error(`Unknown model: ${modelKey}`);
  }

  switch (modelInfo.provider) {
    case 'openai':
      return runOpenAI(prompt, modelInfo.id, config);
    case 'anthropic':
      return runAnthropic(prompt, modelInfo.id, config);
    case 'google':
      return runGoogle(prompt, modelInfo.id, config);
    default:
      throw new Error(`Unsupported provider: ${modelInfo.provider}`);
  }
}

export async function compareModels(
  prompt: string,
  modelKeys: string[],
  config: ModelConfig = {}
): Promise<PromptResult[]> {
  const aggregatedResults: PromptResult[] = [];

  for (let i = 0; i < modelKeys.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = modelKeys.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const batchResults = await Promise.allSettled(
      batch.map((modelKey) => runPrompt(prompt, modelKey, config))
    );

    batchResults.forEach((result, idx) => {
      const modelKey = batch[idx];
      const modelInfo = AI_MODELS[modelKey];

      if (result.status === 'fulfilled') {
        aggregatedResults.push(result.value);
      } else {
        aggregatedResults.push({
          response: `Error: ${result.reason?.message || 'Unknown error'}`,
          tokens_used: 0,
          input_tokens: 0,
          output_tokens: 0,
          duration_ms: 0,
          cost_estimate: 0,
          model: modelInfo.id,
          provider: modelInfo.provider,
        });
      }
    });

    if (i + MAX_CONCURRENT_REQUESTS < modelKeys.length) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  return aggregatedResults;
}
