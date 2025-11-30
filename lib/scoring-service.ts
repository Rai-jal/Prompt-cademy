import { Lesson } from './supabase';

export type ScoreBreakdown = {
  clarity: number;
  constraints: number;
  specificity: number;
  token_efficiency: number;
  criteria_match: number;
  total: number;
  feedback: string[];
};

export function scorePrompt(
  prompt: string,
  lesson: Lesson | null,
  tokensUsed: number
): ScoreBreakdown {
  const feedback: string[] = [];
  let clarity = 0;
  let constraints = 0;
  let specificity = 0;
  let token_efficiency = 0;
  let criteria_match = 0;

  const wordCount = prompt.trim().split(/\s+/).length;
  const promptLower = prompt.toLowerCase();

  if (wordCount >= 10) {
    clarity += 10;
  } else {
    feedback.push('Your prompt is too short. Add more context and detail.');
  }

  if (wordCount <= 150) {
    clarity += 10;
    feedback.push('Good job keeping your prompt concise!');
  } else {
    feedback.push('Consider making your prompt more concise.');
  }

  const hasQuestionWords = /\b(what|how|why|when|where|who|explain|describe|create|write|generate)\b/i.test(
    prompt
  );
  if (hasQuestionWords) {
    specificity += 10;
  } else {
    feedback.push('Use action words like "explain", "create", or "describe" to be more specific.');
  }

  const hasConstraints =
    /\b(in|with|using|exactly|approximately|about|around|less than|more than|\d+)\s*(words?|paragraphs?|sentences?|lines?|characters?)\b/i.test(
      prompt
    );
  if (hasConstraints) {
    constraints += 15;
    feedback.push('Great! You included specific constraints.');
  } else {
    feedback.push('Add constraints like word count, format, or length requirements.');
  }

  const hasTone =
    /\b(professional|casual|friendly|formal|technical|simple|detailed|beginner|advanced)\b/i.test(
      prompt
    );
  if (hasTone) {
    specificity += 10;
    feedback.push('Excellent! You specified the desired tone or style.');
  }

  if (tokensUsed > 0) {
    const efficiency = Math.max(0, 100 - tokensUsed / 10);
    token_efficiency = Math.min(15, Math.round(efficiency / 10));
  } else {
    token_efficiency = 10;
  }

  if (lesson?.expected_criteria) {
    const criteria = lesson.expected_criteria;

    if (criteria.min_words && wordCount >= criteria.min_words) {
      criteria_match += 5;
    }

    if (criteria.max_words && wordCount <= criteria.max_words) {
      criteria_match += 5;
    }

    if (criteria.must_include && Array.isArray(criteria.must_include)) {
      const matches = criteria.must_include.filter((term: string) =>
        promptLower.includes(term.toLowerCase())
      );
      const matchRatio = matches.length / criteria.must_include.length;
      criteria_match += Math.round(matchRatio * 20);

      if (matchRatio < 1) {
        const missing = criteria.must_include.filter(
          (term: string) => !promptLower.includes(term.toLowerCase())
        );
        feedback.push(`Try including these terms: ${missing.join(', ')}`);
      }
    }

    if (criteria.clarity_score_min && clarity >= criteria.clarity_score_min) {
      criteria_match += 5;
    }

    if (criteria.constraints_score_min && constraints >= criteria.constraints_score_min) {
      criteria_match += 5;
    }

    if (criteria.examples_count_min) {
      const exampleMatches = (prompt.match(/example/gi) || []).length;
      if (exampleMatches >= criteria.examples_count_min) {
        criteria_match += 10;
        feedback.push('Perfect! You included examples as required.');
      } else {
        feedback.push(
          `Add at least ${criteria.examples_count_min} examples to strengthen your prompt.`
        );
      }
    }
  } else {
    criteria_match = 20;
  }

  const total = Math.min(
    100,
    clarity + constraints + specificity + token_efficiency + criteria_match
  );

  if (total >= 90) {
    feedback.unshift('Outstanding prompt! You nailed it!');
  } else if (total >= 75) {
    feedback.unshift('Great work! Just a few tweaks could make this perfect.');
  } else if (total >= 60) {
    feedback.unshift('Good start! Review the suggestions below to improve.');
  } else {
    feedback.unshift('Keep practicing! Focus on clarity and specificity.');
  }

  return {
    clarity,
    constraints,
    specificity,
    token_efficiency,
    criteria_match,
    total,
    feedback,
  };
}
