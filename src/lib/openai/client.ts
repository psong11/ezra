/**
 * OpenAI Client Configuration
 */

import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    openaiClient = new OpenAI({
      apiKey,
    });
  }

  return openaiClient;
}

export const OPENAI_MODEL = 'gpt-4o'; // GPT-4o - Most advanced model (GPT-5 not yet released)
export const MAX_TOKENS = 200; // ~120-150 words
export const TEMPERATURE = 0.3; // Lower temperature for more focused, deterministic responses
