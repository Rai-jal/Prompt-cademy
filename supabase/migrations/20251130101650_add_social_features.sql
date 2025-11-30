/*
  # Social Features
  
  1. New Tables
    - `template_comments` - Comments on templates
    - `template_reactions` - Reactions/likes on templates
    - `user_follows` - User following system
  
  2. Security
    - Enable RLS on all new tables
    - Users can create, edit, delete their own comments
    - Users can add/remove their own reactions
    - All users can view public content
*/

-- Template Comments
CREATE TABLE IF NOT EXISTS template_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES prompt_templates(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  comment_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE template_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments on public templates"
  ON template_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prompt_templates
      WHERE id = template_comments.template_id
      AND is_public = true
    )
  );

CREATE POLICY "Users can create comments"
  ON template_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON template_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON template_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Template Reactions
CREATE TABLE IF NOT EXISTS template_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES prompt_templates(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reaction_type text NOT NULL DEFAULT 'like',
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, user_id, reaction_type)
);

ALTER TABLE template_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions on public templates"
  ON template_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prompt_templates
      WHERE id = template_reactions.template_id
      AND is_public = true
    )
  );

CREATE POLICY "Users can create reactions"
  ON template_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON template_reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User Follows
CREATE TABLE IF NOT EXISTS user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows"
  ON user_follows
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow others"
  ON user_follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON user_follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- Add follower/following counts to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'followers_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN followers_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'following_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN following_count integer DEFAULT 0;
  END IF;
END $$;

-- Function to update follower counts
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;
    
    UPDATE profiles SET following_count = following_count + 1
    WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1)
    WHERE id = OLD.following_id;
    
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1)
    WHERE id = OLD.follower_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_follower_counts_trigger
  AFTER INSERT OR DELETE ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follower_counts();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_comments_template_id ON template_comments(template_id);
CREATE INDEX IF NOT EXISTS idx_template_comments_user_id ON template_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_template_reactions_template_id ON template_reactions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_reactions_user_id ON template_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);

-- Function to notify on comments
CREATE OR REPLACE FUNCTION notify_template_comment()
RETURNS TRIGGER AS $$
DECLARE
  template_owner_id uuid;
  commenter_name text;
BEGIN
  SELECT user_id INTO template_owner_id
  FROM prompt_templates
  WHERE id = NEW.template_id;
  
  IF template_owner_id != NEW.user_id THEN
    SELECT full_name INTO commenter_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    PERFORM create_notification(
      template_owner_id,
      'template_comment',
      'New Comment on Your Template',
      commenter_name || ' commented on your template',
      '/templates'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_on_template_comment
  AFTER INSERT ON template_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_template_comment();
