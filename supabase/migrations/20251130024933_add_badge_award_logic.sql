/*
  # Add Badge Award Logic
  
  1. Functions
    - `check_and_award_badges` - Checks user progress and awards badges automatically
  
  2. Triggers
    - Award badges when lessons are completed
    - Award badges when challenges are scored
  
  3. Security
    - Functions run with SECURITY DEFINER to bypass RLS
    - Only automated triggers can award badges
*/

-- Function to check and award badges
CREATE OR REPLACE FUNCTION check_and_award_badges(user_uuid uuid)
RETURNS void AS $$
DECLARE
  lesson_count int;
  challenge_count int;
  perfect_score_exists boolean;
  course_completed boolean;
  first_steps_badge_id uuid;
  perfect_score_badge_id uuid;
  course_champion_badge_id uuid;
BEGIN
  -- Get badge IDs
  SELECT id INTO first_steps_badge_id FROM badges WHERE name = 'First Steps';
  SELECT id INTO perfect_score_badge_id FROM badges WHERE name = 'Perfect Score';
  SELECT id INTO course_champion_badge_id FROM badges WHERE name = 'Course Champion';

  -- Count completed lessons
  SELECT COUNT(*) INTO lesson_count
  FROM user_progress
  WHERE user_id = user_uuid AND status = 'completed';

  -- Award "First Steps" badge for completing first lesson
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for user_progress
CREATE OR REPLACE FUNCTION trigger_check_badges_on_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    PERFORM check_and_award_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for challenge_submissions
CREATE OR REPLACE FUNCTION trigger_check_badges_on_challenge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'scored' THEN
    PERFORM check_and_award_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS check_badges_on_progress ON user_progress;
CREATE TRIGGER check_badges_on_progress
  AFTER INSERT OR UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_badges_on_progress();

DROP TRIGGER IF EXISTS check_badges_on_challenge ON challenge_submissions;
CREATE TRIGGER check_badges_on_challenge
  AFTER INSERT OR UPDATE ON challenge_submissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_badges_on_challenge();

-- Add unique constraint to prevent duplicate badge awards
ALTER TABLE user_badges DROP CONSTRAINT IF EXISTS user_badges_user_badge_unique;
ALTER TABLE user_badges ADD CONSTRAINT user_badges_user_badge_unique UNIQUE (user_id, badge_id);
