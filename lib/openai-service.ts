import 'server-only';

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
  duration_ms: number;
  cost_estimate: number;
};

const OPENAI_PRICING = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
};

export async function runPrompt(
  prompt: string,
  model: string = 'gpt-4o',
  config: ModelConfig = {}
): Promise<PromptResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing OpenAI API key. Add OPENAI_API_KEY (or NEXT_PUBLIC_OPENAI_API_KEY) to your environment.'
    );
  }

  const startTime = Date.now();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature ?? 0.7,
      max_tokens: config.max_tokens ?? 1000,
      top_p: config.top_p,
      frequency_penalty: config.frequency_penalty,
      presence_penalty: config.presence_penalty,
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to get response from OpenAI';
    try {
      const error = await response.json();
      errorMessage = error.error?.message || errorMessage;
    } catch (error) {
      // ignore body parse errors
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();
  const duration_ms = Date.now() - startTime;

  const tokens_used = data.usage.total_tokens;
  const input_tokens = data.usage.prompt_tokens;
  const output_tokens = data.usage.completion_tokens;

  const pricing = OPENAI_PRICING[model as keyof typeof OPENAI_PRICING] || OPENAI_PRICING['gpt-4o'];
  const cost_estimate =
    (input_tokens / 1000) * pricing.input + (output_tokens / 1000) * pricing.output;

  return {
    response: data.choices[0].message.content,
    tokens_used,
    duration_ms,
    cost_estimate,
  };
}
