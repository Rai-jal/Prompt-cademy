import 'server-only';

import { PromptAnalysis } from '@/types/prompt-analysis';
import { runPrompt } from './openai-service';

const sanitizeJson = (raw: string) => {
  if (!raw) return raw;

  let content = raw.trim();

  if (content.startsWith('```')) {
    content = content
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
  }

  const firstCurly = content.indexOf('{');
  const firstBracket = content.indexOf('[');

  if (firstCurly === -1 && firstBracket === -1) {
    return content;
  }

  const startIndex =
    firstCurly === -1
      ? firstBracket
      : firstBracket === -1
        ? firstCurly
        : Math.min(firstCurly, firstBracket);
  const openingChar = content[startIndex];
  const closingChar = openingChar === '{' ? '}' : ']';
  const endIndex = content.lastIndexOf(closingChar);

  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    return content.slice(startIndex, endIndex + 1);
  }

  return content;
};

export async function analyzePrompt(prompt: string): Promise<PromptAnalysis> {
  const analysisPrompt = `You are an expert AI prompt engineer. Analyze the following prompt and provide detailed feedback.

PROMPT TO ANALYZE:
"""
${prompt}
"""

Provide your analysis in the following JSON format:
{
  "score": <number from 0-100>,
  "strengths": [<array of 2-4 specific strengths>],
  "weaknesses": [<array of 2-4 specific weaknesses or areas for improvement>],
  "suggestions": [<array of 3-5 actionable suggestions>],
  "improvedPrompt": "<an improved version of the prompt>"
}

Evaluation criteria:
1. Clarity and specificity
2. Context and background information
3. Clear desired output format
4. Role definition (if applicable)
5. Examples or constraints
6. Appropriate length and detail

Be specific and actionable in your feedback. The improved prompt should incorporate your suggestions.

Remember to respond ONLY with valid JSON.`;

  const response = await runPrompt(analysisPrompt, 'gpt-4o', {
    temperature: 0.3,
    max_tokens: 1500,
  });

  try {
    const cleaned = sanitizeJson(response.response);
    const analysis = JSON.parse(cleaned) as PromptAnalysis;
    return analysis;
  } catch (error) {
    throw new Error('Failed to parse prompt analysis response');
  }
}

export async function generatePromptSuggestions(
  goal: string,
  context?: string
): Promise<string[]> {
  const suggestionPrompt = `Generate 5 high-quality prompt templates for the following goal:

GOAL: ${goal}
${context ? `CONTEXT: ${context}` : ''}

Provide 5 diverse, well-crafted prompt templates that would help achieve this goal. Each should be specific, actionable, and demonstrate best practices in prompt engineering.

Return your response as a JSON array of strings:
["prompt 1", "prompt 2", "prompt 3", "prompt 4", "prompt 5"]

Remember to respond ONLY with valid JSON array.`;

  const response = await runPrompt(suggestionPrompt, 'gpt-4o-mini', {
    temperature: 0.7,
    max_tokens: 1000,
  });

  try {
    const cleaned = sanitizeJson(response.response);
    const suggestions = JSON.parse(cleaned) as string[];
    return suggestions;
  } catch (error) {
    throw new Error('Failed to parse prompt suggestions');
  }
}

export async function improvePromptForModel(
  prompt: string,
  targetModel: string
): Promise<string> {
  const improvementPrompt = `Optimize the following prompt specifically for ${targetModel}:

ORIGINAL PROMPT:
"""
${prompt}
"""

Provide an improved version that:
1. Leverages ${targetModel}'s specific strengths
2. Uses the optimal format and structure for ${targetModel}
3. Maintains the original intent while maximizing effectiveness

Return only the improved prompt, no explanations.`;

  const response = await runPrompt(improvementPrompt, 'gpt-4o', {
    temperature: 0.3,
    max_tokens: 800,
  });

  return response.response;
}

export async function expandPromptWithDetails(
  shortPrompt: string,
  desiredLength: 'short' | 'medium' | 'long' = 'medium'
): Promise<string> {
  const lengthGuidance = {
    short: '2-3 sentences, concise and direct',
    medium: '1-2 paragraphs with good context',
    long: 'detailed multi-paragraph prompt with examples and constraints',
  };

  const expansionPrompt = `Expand the following brief prompt into a more detailed, effective prompt:

BRIEF PROMPT:
"""
${shortPrompt}
"""

Create a ${lengthGuidance[desiredLength]} prompt that:
1. Adds necessary context and background
2. Defines the desired output format clearly
3. Includes any helpful constraints or guidelines
4. Maintains the original intent

Return only the expanded prompt, no explanations.`;

  const response = await runPrompt(expansionPrompt, 'gpt-4o', {
    temperature: 0.5,
    max_tokens: 600,
  });

  return response.response;
}
