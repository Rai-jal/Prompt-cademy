/*
  # User API Keys Management
  
  1. New Tables
    - `user_api_keys` - Store encrypted user API keys
    
  2. Security
    - Enable RLS
    - Users can only manage their own keys
*/

-- User API keys table
CREATE TABLE IF NOT EXISTS user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  key_name text NOT NULL,
  encrypted_key text NOT NULL,
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own API keys"
  ON user_api_keys
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys"
  ON user_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON user_api_keys
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON user_api_keys
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  resource_type text NOT NULL,
  tokens_used integer DEFAULT 0,
  cost_amount numeric DEFAULT 0,
  model text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage logs"
  ON usage_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage logs"
  ON usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usage quotas
CREATE TABLE IF NOT EXISTS usage_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_type text DEFAULT 'free',
  monthly_token_limit integer DEFAULT 100000,
  monthly_cost_limit numeric DEFAULT 10.00,
  tokens_used_this_month integer DEFAULT 0,
  cost_used_this_month numeric DEFAULT 0,
  quota_reset_date timestamptz DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quota"
  ON usage_quotas
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own quota"
  ON usage_quotas
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to create default quota for new users
CREATE OR REPLACE FUNCTION create_default_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO usage_quotas (user_id, plan_type)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_quota_on_profile
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_quota();

-- Function to reset monthly quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
  UPDATE usage_quotas
  SET 
    tokens_used_this_month = 0,
    cost_used_this_month = 0,
    quota_reset_date = date_trunc('month', now()) + interval '1 month',
    updated_at = now()
  WHERE quota_reset_date <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log usage and update quota
CREATE OR REPLACE FUNCTION log_usage_and_update_quota(
  p_user_id uuid,
  p_resource_type text,
  p_tokens_used integer,
  p_cost_amount numeric,
  p_model text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS boolean AS $$
DECLARE
  quota_exceeded boolean := false;
  current_quota RECORD;
BEGIN
  SELECT * INTO current_quota
  FROM usage_quotas
  WHERE user_id = p_user_id;
  
  IF current_quota.tokens_used_this_month + p_tokens_used > current_quota.monthly_token_limit OR
     current_quota.cost_used_this_month + p_cost_amount > current_quota.monthly_cost_limit THEN
    quota_exceeded := true;
  END IF;
  
  IF NOT quota_exceeded THEN
    INSERT INTO usage_logs (user_id, resource_type, tokens_used, cost_amount, model, metadata)
    VALUES (p_user_id, p_resource_type, p_tokens_used, p_cost_amount, p_model, p_metadata);
    
    UPDATE usage_quotas
    SET 
      tokens_used_this_month = tokens_used_this_month + p_tokens_used,
      cost_used_this_month = cost_used_this_month + p_cost_amount,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN NOT quota_exceeded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_user_id ON usage_quotas(user_id);
