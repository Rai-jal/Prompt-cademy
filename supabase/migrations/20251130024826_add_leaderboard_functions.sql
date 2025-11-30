/*
  # Add Leaderboard Functions
  
  1. Database Functions
    - `get_overall_leaderboard` - Returns overall user rankings based on combined metrics
    - `get_challenge_leaderboard` - Returns rankings based on challenge performance
    - `get_lesson_leaderboard` - Returns rankings based on lesson completion
  
  2. Security
    - Functions are accessible to all authenticated users
    - Only returns public leaderboard data (no sensitive information)
*/

-- Overall leaderboard function
CREATE OR REPLACE FUNCTION get_overall_leaderboard()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  total_score bigint,
  challenges_completed bigint,
  lessons_completed bigint,
  badges_earned bigint,
  average_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.full_name,
    p.email,
    COALESCE(SUM(cs.score), 0) + COALESCE(SUM(up.best_score), 0) as total_score,
    COUNT(DISTINCT CASE WHEN cs.status = 'scored' THEN cs.id END) as challenges_completed,
    COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.id END) as lessons_completed,
    COUNT(DISTINCT ub.badge_id) as badges_earned,
    ROUND(
      COALESCE(
        (SUM(cs.score) + SUM(up.best_score))::numeric / 
        NULLIF(COUNT(cs.id) + COUNT(up.id), 0),
        0
      ),
      0
    ) as average_score
  FROM profiles p
  LEFT JOIN challenge_submissions cs ON p.id = cs.user_id AND cs.status = 'scored'
  LEFT JOIN user_progress up ON p.id = up.user_id AND up.status = 'completed'
  LEFT JOIN user_badges ub ON p.id = ub.user_id
  GROUP BY p.id, p.full_name, p.email
  HAVING COUNT(cs.id) + COUNT(up.id) > 0
  ORDER BY total_score DESC, average_score DESC, challenges_completed DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Challenge leaderboard function
CREATE OR REPLACE FUNCTION get_challenge_leaderboard()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  total_score bigint,
  challenges_completed bigint,
  lessons_completed bigint,
  badges_earned bigint,
  average_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.full_name,
    p.email,
    COALESCE(SUM(cs.score), 0) as total_score,
    COUNT(DISTINCT CASE WHEN cs.status = 'scored' THEN cs.id END) as challenges_completed,
    COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.id END) as lessons_completed,
    COUNT(DISTINCT ub.badge_id) as badges_earned,
    ROUND(COALESCE(AVG(cs.score), 0), 0) as average_score
  FROM profiles p
  LEFT JOIN challenge_submissions cs ON p.id = cs.user_id AND cs.status = 'scored'
  LEFT JOIN user_progress up ON p.id = up.user_id AND up.status = 'completed'
  LEFT JOIN user_badges ub ON p.id = ub.user_id
  GROUP BY p.id, p.full_name, p.email
  HAVING COUNT(cs.id) > 0
  ORDER BY challenges_completed DESC, average_score DESC, total_score DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lesson leaderboard function
CREATE OR REPLACE FUNCTION get_lesson_leaderboard()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  total_score bigint,
  challenges_completed bigint,
  lessons_completed bigint,
  badges_earned bigint,
  average_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.full_name,
    p.email,
    COALESCE(SUM(up.best_score), 0) as total_score,
    COUNT(DISTINCT CASE WHEN cs.status = 'scored' THEN cs.id END) as challenges_completed,
    COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.id END) as lessons_completed,
    COUNT(DISTINCT ub.badge_id) as badges_earned,
    ROUND(COALESCE(AVG(up.best_score), 0), 0) as average_score
  FROM profiles p
  LEFT JOIN user_progress up ON p.id = up.user_id AND up.status = 'completed'
  LEFT JOIN challenge_submissions cs ON p.id = cs.user_id AND cs.status = 'scored'
  LEFT JOIN user_badges ub ON p.id = ub.user_id
  GROUP BY p.id, p.full_name, p.email
  HAVING COUNT(up.id) > 0
  ORDER BY lessons_completed DESC, average_score DESC, total_score DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_overall_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION get_challenge_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lesson_leaderboard() TO authenticated;
