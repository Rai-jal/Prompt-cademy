'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export type UserApiKey = {
  id: string;
  provider: 'openai' | 'anthropic' | 'google';
  is_active: boolean;
};

export function useUserApiKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchKeys = async () => {
      if (!user) {
        setKeys([]);
        setError(null);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('id, provider, is_active')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setKeys([]);
      } else {
        setError(null);
        setKeys(data ?? []);
      }
      setLoading(false);
    };

    fetchKeys();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { keys, loading, error };
}

