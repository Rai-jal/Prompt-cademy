/*
  # Add Streak Tracking System
  
  1. New Columns
    - `profiles.current_streak` - Current consecutive days of activity
    - `profiles.longest_streak` - Longest streak ever achieved
    - `profiles.last_activity_date` - Last date user was active
  
  2. Functions
    - `update_user_streak` - Updates streak based on activity
  
  3. Triggers
    - Automatically update streaks when users complete lessons or challenges
  
  4. Security
    - Functions run with SECURITY DEFINER
*/

-- Add streak columns to profiles table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'current_streak'
  ) THEN
    ALTER TABLE profiles ADD COLUMN current_streak integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'longest_streak'
  ) THEN
    ALTER TABLE profiles ADD COLUMN longest_streak integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_activity_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_activity_date date DEFAULT NULL;
  END IF;
END $$;

-- Function to update user streak
CREATE OR REPLACE FUNCTION update_user_streak(user_uuid uuid)
RETURNS void AS $$
DECLARE
  last_activity date;
  current_streak_count int;
  longest_streak_count int;
  today date := CURRENT_DATE;
BEGIN
  -- Get current streak data
  SELECT last_activity_date, current_streak, longest_streak
  INTO last_activity, current_streak_count, longest_streak_count
  FROM profiles
  WHERE id = user_uuid;

  -- If no previous activity or activity was more than 1 day ago, reset streak
  IF last_activity IS NULL THEN
    -- First activity
    current_streak_count := 1;
  ELSIF last_activity = today THEN
    -- Already logged activity today, no change
    RETURN;
  ELSIF last_activity = today - INTERVAL '1 day' THEN
    -- Activity yesterday, increment streak
    current_streak_count := current_streak_count + 1;
  ELSE
    -- Gap in activity, reset streak
    current_streak_count := 1;
  END IF;

  -- Update longest streak if current is higher
  IF current_streak_count > longest_streak_count THEN
    longest_streak_count := current_streak_count;
  END IF;

  -- Update profile
  UPDATE profiles
  SET 
    current_streak = current_streak_count,
    longest_streak = longest_streak_count,
    last_activity_date = today
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing triggers to also update streak
CREATE OR REPLACE FUNCTION trigger_update_streak_on_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    PERFORM update_user_streak(NEW.user_id);
    PERFORM check_and_award_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_update_streak_on_challenge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'scored' THEN
    PERFORM update_user_streak(NEW.user_id);
    PERFORM check_and_award_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
DROP TRIGGER IF EXISTS check_badges_on_progress ON user_progress;
CREATE TRIGGER check_badges_on_progress
  AFTER INSERT OR UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_streak_on_progress();

DROP TRIGGER IF EXISTS check_badges_on_challenge ON challenge_submissions;
CREATE TRIGGER check_badges_on_challenge
  AFTER INSERT OR UPDATE ON challenge_submissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_streak_on_challenge();

-- Add streak badges
INSERT INTO badges (name, description, criteria, rarity)
VALUES 
  ('Week Warrior', 'Maintained a 7-day streak', '{"streak_days": 7}'::jsonb, 'rare'),
  ('Consistency Champion', 'Maintained a 30-day streak', '{"streak_days": 30}'::jsonb, 'epic'),
  ('Unstoppable', 'Maintained a 100-day streak', '{"streak_days": 100}'::jsonb, 'legendary')
ON CONFLICT DO NOTHING;

-- Update badge award logic to include streak badges
CREATE OR REPLACE FUNCTION check_and_award_badges(user_uuid uuid)
RETURNS void AS $$
DECLARE
  lesson_count int;
  challenge_count int;
  perfect_score_exists boolean;
  course_completed boolean;
  current_streak_days int;
  first_steps_badge_id uuid;
  perfect_score_badge_id uuid;
  course_champion_badge_id uuid;
  week_warrior_badge_id uuid;
  consistency_champion_badge_id uuid;
  unstoppable_badge_id uuid;
BEGIN
  -- Get badge IDs
  SELECT id INTO first_steps_badge_id FROM badges WHERE name = 'First Steps';
  SELECT id INTO perfect_score_badge_id FROM badges WHERE name = 'Perfect Score';
  SELECT id INTO course_champion_badge_id FROM badges WHERE name = 'Course Champion';
  SELECT id INTO week_warrior_badge_id FROM badges WHERE name = 'Week Warrior';
  SELECT id INTO consistency_champion_badge_id FROM badges WHERE name = 'Consistency Champion';
  SELECT id INTO unstoppable_badge_id FROM badges WHERE name = 'Unstoppable';

  -- Get current streak
  SELECT current_streak INTO current_streak_days
  FROM profiles
  WHERE id = user_uuid;

  -- Count completed lessons
  SELECT COUNT(*) INTO lesson_count
  FROM user_progress
  WHERE user_id = user_uuid AND status = 'completed';

  -- Award "First Steps" badge
  IF lesson_count >= 1 AND first_steps_badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (user_uuid, first_steps_badge_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Check for perfect scores
  SELECT EXISTS (
    SELECT 1 FROM user_progress
    WHERE user_id = user_uuid AND best_score = 100
    UNION
    SELECT 1 FROM challenge_submissions
    WHERE user_id = user_uuid AND score = 100
  ) INTO perfect_score_exists;

  -- Award "Perfect Score" badge
  IF perfect_score_exists AND perfect_score_badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (user_uuid, perfect_score_badge_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Check if any course is fully completed
  SELECT EXISTS (
    SELECT 1
    FROM courses c
    WHERE NOT EXISTS (
      SELECT 1
      FROM lessons l
      LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = user_uuid AND up.status = 'completed'
      WHERE l.course_id = c.id AND up.id IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM lessons WHERE course_id = c.id
    )
  ) INTO course_completed;

  -- Award "Course Champion" badge
  IF course_completed AND course_champion_badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (user_uuid, course_champion_badge_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Award streak badges
  IF current_streak_days >= 7 AND week_warrior_badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (user_uuid, week_warrior_badge_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF current_streak_days >= 30 AND consistency_champion_badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (user_uuid, consistency_champion_badge_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF current_streak_days >= 100 AND unstoppable_badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (user_uuid, unstoppable_badge_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
