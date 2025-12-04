import type { AIProvider } from '@/lib/ai-models';

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
  error?: string;
};

