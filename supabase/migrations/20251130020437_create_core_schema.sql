/*
  # Promptcademy Core Database Schema
  
  ## Overview
  Creates the foundational database structure for Promptcademy.co - an interactive platform 
  for learning prompt engineering through gamified lessons and real-world challenges.
  
  ## New Tables
  
  ### `profiles`
  User profile and preferences
  - `id` (uuid, FK to auth.users) - Links to Supabase auth
  - `email` (text) - User email
  - `full_name` (text) - Display name
  - `avatar_url` (text) - Profile picture URL
  - `goals` (text[]) - Selected learning goals (writing, coding, design, research, general)
  - `skill_level` (text) - beginner, intermediate, advanced
  - `bio` (text) - User biography
  - `onboarding_completed` (boolean) - Has completed onboarding flow
  - `created_at` (timestamptz) - Account creation time
  - `updated_at` (timestamptz) - Last profile update
  
  ### `courses`
  Learning courses organized by goal
  - `id` (uuid, PK) - Unique course identifier
  - `title` (text) - Course name
  - `description` (text) - Course overview
  - `goal` (text) - Target goal (writing, coding, design, research, general)
  - `difficulty` (text) - beginner, intermediate, advanced
  - `order_index` (integer) - Display order
  - `is_published` (boolean) - Visibility flag
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `lessons`
  Individual lessons within courses
  - `id` (uuid, PK) - Unique lesson identifier
  - `course_id` (uuid, FK) - Parent course
  - `title` (text) - Lesson name
  - `content` (jsonb) - Lesson content (markdown, examples, hints)
  - `order_index` (integer) - Order within course
  - `expected_criteria` (jsonb) - Success criteria for scoring
  - `example_prompts` (text[]) - Example prompts to guide users
  - `hints` (text[]) - Progressive hints
  - `estimated_duration` (integer) - Minutes to complete
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `prompt_templates`
  Reusable prompt templates
  - `id` (uuid, PK) - Unique template identifier
  - `creator_id` (uuid, FK) - User who created it
  - `lesson_id` (uuid, FK, nullable) - Associated lesson if any
  - `title` (text) - Template name
  - `content` (text) - The prompt text
  - `description` (text) - What this prompt does
  - `tags` (text[]) - Categorization tags
  - `model_recommendation` (text) - Recommended AI model
  - `is_public` (boolean) - Shareable with community
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `prompt_attempts`
  User prompt submissions and results
  - `id` (uuid, PK) - Unique attempt identifier
  - `user_id` (uuid, FK) - User who made the attempt
  - `lesson_id` (uuid, FK, nullable) - Associated lesson
  - `template_id` (uuid, FK, nullable) - Based on template
  - `prompt_text` (text) - The actual prompt submitted
  - `model` (text) - AI model used (gpt-4, claude-3, etc)
  - `model_params` (jsonb) - Parameters (temperature, max_tokens, etc)
  - `model_response` (text) - AI response
  - `score` (integer) - Overall quality score (0-100)
  - `score_breakdown` (jsonb) - Detailed scoring (clarity, constraints, etc)
  - `tokens_used` (integer) - Token consumption
  - `cost_estimate` (decimal) - Estimated API cost
  - `duration_ms` (integer) - Response time in milliseconds
  - `created_at` (timestamptz)
  
  ### `user_progress`
  Track lesson completion and progress
  - `id` (uuid, PK) - Unique progress record
  - `user_id` (uuid, FK) - User
  - `lesson_id` (uuid, FK) - Lesson
  - `status` (text) - not_started, in_progress, completed
  - `best_score` (integer) - Highest score achieved
  - `attempts_count` (integer) - Number of attempts
  - `completed_at` (timestamptz, nullable) - When completed
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `challenges`
  Timed and untimed prompt challenges
  - `id` (uuid, PK) - Unique challenge identifier
  - `title` (text) - Challenge name
  - `description` (text) - Challenge overview
  - `difficulty` (text) - beginner, intermediate, advanced
  - `goal` (text) - Target goal area
  - `spec` (jsonb) - Detailed requirements
  - `test_cases` (jsonb) - Automated validation tests
  - `time_limit_minutes` (integer, nullable) - Time constraint
  - `reward_badge_id` (uuid, FK, nullable) - Badge awarded on completion
  - `is_active` (boolean) - Currently available
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `badges`
  Achievement badges
  - `id` (uuid, PK) - Unique badge identifier
  - `name` (text) - Badge name
  - `description` (text) - How to earn it
  - `icon_url` (text) - Badge image
  - `criteria` (jsonb) - Earning requirements
  - `rarity` (text) - common, rare, epic, legendary
  - `created_at` (timestamptz)
  
  ### `user_badges`
  Badges earned by users
  - `id` (uuid, PK) - Unique record
  - `user_id` (uuid, FK) - User
  - `badge_id` (uuid, FK) - Badge earned
  - `earned_at` (timestamptz) - When earned
  
  ## Security
  
  All tables have Row Level Security (RLS) enabled with restrictive policies:
  - Users can only view/edit their own data
  - Courses, lessons, challenges, and badges are publicly readable
  - Only authenticated users can create prompt attempts and templates
  
  ## Indexes
  
  Performance indexes added for:
  - Foreign key relationships
  - Common query patterns (user_id, lesson_id, course_id)
  - Timestamp-based queries
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  goals text[] DEFAULT '{}',
  skill_level text DEFAULT 'beginner' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  bio text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  goal text NOT NULL CHECK (goal IN ('writing', 'coding', 'design', 'research', 'general')),
  difficulty text DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  order_index integer DEFAULT 0,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  content jsonb DEFAULT '{}',
  order_index integer DEFAULT 0,
  expected_criteria jsonb DEFAULT '{}',
  example_prompts text[] DEFAULT '{}',
  hints text[] DEFAULT '{}',
  estimated_duration integer DEFAULT 15,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create prompt_templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  model_recommendation text DEFAULT 'gpt-4o',
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create prompt_attempts table
CREATE TABLE IF NOT EXISTS prompt_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  template_id uuid REFERENCES prompt_templates(id) ON DELETE SET NULL,
  prompt_text text NOT NULL,
  model text NOT NULL DEFAULT 'gpt-4o',
  model_params jsonb DEFAULT '{}',
  model_response text,
  score integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  score_breakdown jsonb DEFAULT '{}',
  tokens_used integer DEFAULT 0,
  cost_estimate numeric(10, 6) DEFAULT 0,
  duration_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  best_score integer DEFAULT 0,
  attempts_count integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Create challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  difficulty text DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  goal text NOT NULL CHECK (goal IN ('writing', 'coding', 'design', 'research', 'general')),
  spec jsonb DEFAULT '{}',
  test_cases jsonb DEFAULT '{}',
  time_limit_minutes integer,
  reward_badge_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  icon_url text,
  criteria jsonb DEFAULT '{}',
  rarity text DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  created_at timestamptz DEFAULT now()
);

-- Create user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Add foreign key for challenges -> badges
ALTER TABLE challenges ADD CONSTRAINT fk_challenges_badge 
  FOREIGN KEY (reward_badge_id) REFERENCES badges(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_prompt_attempts_user ON prompt_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_attempts_lesson ON prompt_attempts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_lesson ON user_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_creator ON prompt_templates(creator_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Courses policies (public read)
CREATE POLICY "Anyone can view published courses"
  ON courses FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Lessons policies (public read)
CREATE POLICY "Anyone can view lessons"
  ON lessons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = lessons.course_id 
      AND courses.is_published = true
    )
  );

-- Prompt templates policies
CREATE POLICY "Users can view public templates"
  ON prompt_templates FOR SELECT
  TO authenticated
  USING (is_public = true OR creator_id = auth.uid());

CREATE POLICY "Users can create own templates"
  ON prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can update own templates"
  ON prompt_templates FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON prompt_templates FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Prompt attempts policies
CREATE POLICY "Users can view own attempts"
  ON prompt_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own attempts"
  ON prompt_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User progress policies
CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Challenges policies (public read)
CREATE POLICY "Anyone can view active challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Badges policies (public read)
CREATE POLICY "Anyone can view badges"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

-- User badges policies
CREATE POLICY "Users can view own badges"
  ON user_badges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can award badges"
  ON user_badges FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();