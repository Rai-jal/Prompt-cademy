/*
  # Prompt Template Versioning
  
  1. New Tables
    - `template_versions` - Version history for templates
    
  2. Functions
    - Automatic versioning on template updates
    - Version comparison
*/

-- Template versions table
CREATE TABLE IF NOT EXISTS template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES prompt_templates(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  title text NOT NULL,
  description text,
  content text NOT NULL,
  tags text[],
  model_recommendation text,
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  change_notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for template versions
CREATE POLICY "Users can view versions of their templates"
  ON template_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prompt_templates
      WHERE prompt_templates.id = template_versions.template_id
      AND (
        prompt_templates.creator_id = auth.uid() OR
        prompt_templates.is_public = true
      )
    )
  );

CREATE POLICY "System can create versions"
  ON template_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to create version on template update
CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.content != NEW.content OR 
       OLD.title != NEW.title OR 
       OLD.description IS DISTINCT FROM NEW.description THEN
      
      INSERT INTO template_versions (
        template_id,
        version_number,
        title,
        description,
        content,
        tags,
        model_recommendation,
        changed_by
      )
      VALUES (
        OLD.id,
        COALESCE((
          SELECT MAX(version_number) 
          FROM template_versions 
          WHERE template_id = OLD.id
        ), 0) + 1,
        OLD.title,
        OLD.description,
        OLD.content,
        OLD.tags,
        OLD.model_recommendation,
        auth.uid()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER template_version_trigger
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION create_template_version();

-- Team template versions
CREATE TABLE IF NOT EXISTS team_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES team_templates(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  title text NOT NULL,
  description text,
  content text NOT NULL,
  tags text[],
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  change_notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view team template versions"
  ON team_template_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_templates
      JOIN team_members ON team_members.team_id = team_templates.team_id
      WHERE team_templates.id = team_template_versions.template_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create team template versions"
  ON team_template_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function for team template versioning
CREATE OR REPLACE FUNCTION create_team_template_version()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.content != NEW.content OR 
       OLD.title != NEW.title OR 
       OLD.description IS DISTINCT FROM NEW.description THEN
      
      INSERT INTO team_template_versions (
        template_id,
        version_number,
        title,
        description,
        content,
        tags,
        changed_by
      )
      VALUES (
        OLD.id,
        OLD.version,
        OLD.title,
        OLD.description,
        OLD.content,
        OLD.tags,
        auth.uid()
      );
      
      NEW.version = OLD.version + 1;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER team_template_version_trigger
  BEFORE UPDATE ON team_templates
  FOR EACH ROW
  EXECUTE FUNCTION create_team_template_version();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_team_template_versions_template_id ON team_template_versions(template_id);
