import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  goals: string[];
  skill_level: 'beginner' | 'intermediate' | 'advanced';
  bio: string | null;
  role: 'user' | 'admin' | 'teacher';
  onboarding_completed: boolean;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  followers_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
};

export type Course = {
  id: string;
  title: string;
  description: string | null;
  goal: 'writing' | 'coding' | 'design' | 'research' | 'general';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  course_id: string;
  title: string;
  content: {
    introduction: string;
    sections?: Array<{ heading: string; content: string }>;
    task: string;
  };
  order_index: number;
  expected_criteria: Record<string, any>;
  example_prompts: string[];
  hints: string[];
  estimated_duration: number;
  created_at: string;
  updated_at: string;
};

export type PromptAttempt = {
  id: string;
  user_id: string;
  lesson_id: string | null;
  template_id: string | null;
  prompt_text: string;
  model: string;
  model_params: Record<string, any>;
  model_response: string | null;
  score: number;
  score_breakdown: Record<string, any>;
  tokens_used: number;
  cost_estimate: number;
  duration_ms: number;
  created_at: string;
};

export type UserProgress = {
  id: string;
  user_id: string;
  lesson_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  best_score: number;
  attempts_count: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
