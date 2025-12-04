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

