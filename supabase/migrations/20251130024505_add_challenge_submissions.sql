/*
  # Add Challenge Submissions Table
  
  ## New Table
  - `challenge_submissions` - Stores user challenge submissions
    - `id` (uuid, PK)
    - `user_id` (uuid, FK to profiles)
    - `challenge_id` (uuid, FK to challenges)
    - `prompt_text` (text) - The prompt they created
    - `ai_response` (text) - Result from running the prompt
    - `model_used` (text) - Which AI model was used
    - `score` (integer) - Total score (0-100)
    - `score_breakdown` (jsonb) - Detailed scoring by criteria
    - `feedback` (text) - AI-generated feedback on submission
    - `status` (text) - pending, scored, reviewed
    - `submitted_at` (timestamptz)
    - `scored_at` (timestamptz, nullable)
  
  ## Security
  - RLS enabled
  - Users can only view and create their own submissions
  - Admins can view all submissions
*/

CREATE TABLE IF NOT EXISTS challenge_submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  prompt_text text NOT NULL,
  ai_response text,
  model_used text DEFAULT 'gpt-4o',
  score integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  score_breakdown jsonb DEFAULT '{}',
  feedback text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'scored', 'reviewed')),
  submitted_at timestamptz DEFAULT now(),
  scored_at timestamptz,
  UNIQUE(user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_user ON challenge_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_challenge ON challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_score ON challenge_submissions(score DESC);

ALTER TABLE challenge_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own submissions"
  ON challenge_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own submissions"
  ON challenge_submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own submissions"
  ON challenge_submissions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all submissions"
  ON challenge_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'teacher')
    )
  );