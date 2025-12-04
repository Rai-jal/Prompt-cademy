import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { AI_MODELS, type AIProvider } from '@/lib/ai-models';
import { executeModelRuns } from '@/lib/server/ai-runner';
import type { ModelConfig } from '@/types/ai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const decodeKey = (encoded?: string | null) => {
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, modelKeys, config }: { prompt?: string; modelKeys?: string[]; config?: ModelConfig } =
      await request.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }

    if (!Array.isArray(modelKeys) || modelKeys.length === 0) {
      return NextResponse.json({ error: 'At least one model is required.' }, { status: 400 });
    }

    const invalidModel = modelKeys.find((key) => !AI_MODELS[key]);
    if (invalidModel) {
      return NextResponse.json({ error: `Unknown model: ${invalidModel}` }, { status: 400 });
    }

    const { data: apiKeyRows } = await supabase
      .from('user_api_keys')
      .select('provider, encrypted_key, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const providerKeys: Partial<Record<AIProvider, string>> = {};

    apiKeyRows?.forEach((row) => {
      const provider = row.provider as AIProvider;
      const decoded = decodeKey(row.encrypted_key);
      if (decoded) {
        providerKeys[provider] = decoded;
      }
    });

    const results = await executeModelRuns({
      prompt: prompt.trim(),
      modelKeys,
      config,
      providerKeys,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('AI run error', error);
    return NextResponse.json(
      { error: 'Failed to run AI models. Please try again later.' },
      { status: 500 }
    );
  }
}

