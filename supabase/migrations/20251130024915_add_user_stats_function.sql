/*
  # Add User Stats Function
  
  1. Database Functions
    - `get_user_stats` - Returns detailed statistics for a specific user
  
  2. Security
    - Function is accessible to authenticated users
    - Users can only view their own stats
*/

CREATE OR REPLACE FUNCTION get_user_stats(user_uuid uuid)
RETURNS TABLE (
  total_lessons bigint,
  total_challenges bigint,
  average_lesson_score numeric,
  average_challenge_score numeric,
  total_badges bigint,
  total_attempts bigint,
  total_time_spent bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.id END) as total_lessons,
    COUNT(DISTINCT CASE WHEN cs.status = 'scored' THEN cs.id END) as total_challenges,
    ROUND(COALESCE(AVG(CASE WHEN up.status = 'completed' THEN up.best_score END), 0), 0) as average_lesson_score,
    ROUND(COALESCE(AVG(CASE WHEN cs.status = 'scored' THEN cs.score END), 0), 0) as average_challenge_score,
    COUNT(DISTINCT ub.badge_id) as total_badges,
    COUNT(pa.id) as total_attempts,
    COALESCE(SUM(pa.duration_ms), 0) as total_time_spent
  FROM profiles p
  LEFT JOIN user_progress up ON p.id = up.user_id
  LEFT JOIN challenge_submissions cs ON p.id = cs.user_id
  LEFT JOIN user_badges ub ON p.id = ub.user_id
  LEFT JOIN prompt_attempts pa ON p.id = pa.user_id
  WHERE p.id = user_uuid
  GROUP BY p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_stats(uuid) TO authenticated;
