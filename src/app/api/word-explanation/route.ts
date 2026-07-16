import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  generateWordExplanationPrompt,
  EXPLANATION_SYSTEM_PROMPT,
} from '@/lib/explanation/prompt';
import {
  explanationCacheKey,
  getCachedExplanation,
  setCachedExplanation,
} from '@/lib/explanation/cache';

const MODEL = process.env.WORD_EXPLANATION_MODEL ?? 'gpt-4o';

const WordExplanationRequestSchema = z.object({
  word: z.string().min(1, 'Word is required'),
  language: z.string().default('Hebrew'),
  verse: z.string().min(1, 'Verse context is required'),
  bookName: z.string().optional(),
  chapterNum: z.number().optional(),
  verseNum: z.number().optional(),
});

function textResponse(body: BodyInit, cache: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Cache': cache,
    },
  });
}

/**
 * POST /api/word-explanation
 * Returns the explanation as a plain-text stream (raw markdown-ish text;
 * the client formats it). Cache hits return the full text immediately;
 * misses stream from the model and persist on completion.
 */
export async function POST(request: NextRequest) {
  let validatedData: z.infer<typeof WordExplanationRequestSchema>;
  try {
    validatedData = WordExplanationRequestSchema.parse(await request.json());
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Invalid request', message: error.message },
      { status: 400 }
    );
  }

  const { word, language, verse } = validatedData;
  const key = explanationCacheKey(word, language, verse);

  const cached = await getCachedExplanation(key);
  if (cached) {
    return textResponse(cached.text, `HIT-${cached.source}`);
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: 'OpenAI API key not configured',
        message: 'Please set OPENAI_API_KEY environment variable',
      },
      { status: 503 }
    );
  }

  try {
    const result = streamText({
      model: openai(MODEL),
      instructions: EXPLANATION_SYSTEM_PROMPT,
      prompt: generateWordExplanationPrompt(validatedData),
      temperature: 0.3,
      maxOutputTokens: 700,
      abortSignal: request.signal,
    });

    const encoder = new TextEncoder();
    let fullText = '';

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          // Persist before closing so the serverless function is still
          // alive for the write; skip aborted/empty generations
          if (fullText.trim().length > 0) {
            await setCachedExplanation(key, fullText);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return textResponse(stream, 'MISS');
  } catch (error: any) {
    console.error('Word explanation API error:', error);
    return NextResponse.json(
      { error: 'AI service error', message: error.message || 'An unexpected error occurred' },
      { status: 502 }
    );
  }
}
