/*
  # Team Workspaces and Collaboration
  
  1. New Tables
    - `teams` - Team workspaces
    - `team_members` - Team membership
    - `team_templates` - Shared team templates
    - `team_activity` - Team activity log
  
  2. Security
    - Enable RLS on all tables
    - Team members can view team resources
    - Team admins can manage team settings
    - Team owners have full control
*/

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan text DEFAULT 'free',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Team templates (shared workspace templates)
CREATE TABLE IF NOT EXISTS team_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  content text NOT NULL,
  tags text[],
  model_recommendation text,
  category text,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE team_templates ENABLE ROW LEVEL SECURITY;

-- Team activity log
CREATE TABLE IF NOT EXISTS team_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
CREATE POLICY "Team owners and members can view teams"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create teams"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Team owners can update teams"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Team owners can delete teams"
  ON teams
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- RLS Policies for team_members
CREATE POLICY "Team members can view membership"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team owners and admins can add members"
  ON team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND (teams.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.team_id = team_members.team_id
          AND tm.user_id = auth.uid()
          AND tm.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Team owners and admins can remove members"
  ON team_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND (teams.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.team_id = team_members.team_id
          AND tm.user_id = auth.uid()
          AND tm.role = 'admin'
        )
      )
    ) OR user_id = auth.uid()
  );

-- RLS Policies for team_templates
CREATE POLICY "Team members can view team templates"
  ON team_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_templates.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create templates"
  ON team_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_templates.team_id
      AND team_members.user_id = auth.uid()
    ) AND auth.uid() = created_by
  );

CREATE POLICY "Template creators and admins can update templates"
  ON team_templates
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_templates.team_id
      AND teams.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_templates.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_templates.team_id
      AND teams.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_templates.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  );

CREATE POLICY "Template creators and admins can delete templates"
  ON team_templates
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_templates.team_id
      AND teams.owner_id = auth.uid()
    )
  );

-- RLS Policies for team_activity
CREATE POLICY "Team members can view activity"
  ON team_activity
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_activity.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create activity"
  ON team_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_activity.team_id
      AND team_members.user_id = auth.uid()
    ) AND auth.uid() = user_id
  );

-- Function to log team activity
CREATE OR REPLACE FUNCTION log_team_activity(
  p_team_id uuid,
  p_user_id uuid,
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  activity_id uuid;
BEGIN
  INSERT INTO team_activity (team_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (p_team_id, p_user_id, p_action, p_resource_type, p_resource_id, p_metadata)
  RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add team owner as first member
CREATE OR REPLACE FUNCTION add_team_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  
  PERFORM log_team_activity(
    NEW.id,
    NEW.owner_id,
    'team_created',
    'team',
    NEW.id,
    jsonb_build_object('team_name', NEW.name)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER add_owner_on_team_create
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION add_team_owner_as_member();

-- Function to notify team members
CREATE OR REPLACE FUNCTION notify_team_members(
  p_team_id uuid,
  p_notification_type text,
  p_title text,
  p_message text,
  p_link text DEFAULT NULL,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  member_record RECORD;
BEGIN
  FOR member_record IN
    SELECT user_id FROM team_members
    WHERE team_id = p_team_id
    AND (p_exclude_user_id IS NULL OR user_id != p_exclude_user_id)
  LOOP
    PERFORM create_notification(
      member_record.user_id,
      p_notification_type,
      p_title,
      p_message,
      p_link
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_templates_team_id ON team_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_team_id ON team_activity(team_id);
