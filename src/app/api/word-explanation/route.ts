import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { streamText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  generateWordExplanationPrompt,
  EXPLANATION_SYSTEM_PROMPT,
} from '@/lib/explanation/prompt';
import { wordStudySchema } from '@/lib/explanation/schema';
import { alignSegmentsToWord } from '@/lib/explanation/morphemes';
import { tightenOccurrenceText } from '@/lib/explanation/occurrences';
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

function jsonTextResponse(body: BodyInit, cache: string): Response {
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
 * Streams a WordStudy as JSON text (consumed by useObject on the client).
 * Cache hits return the full JSON immediately; misses stream from the
 * model and persist after schema validation.
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
    return jsonTextResponse(cached.text, `HIT-${cached.source}`);
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
      output: Output.object({ schema: wordStudySchema }),
      instructions: EXPLANATION_SYSTEM_PROMPT,
      prompt: generateWordExplanationPrompt(validatedData),
      temperature: 0.3,
      maxOutputTokens: 1400,
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
          // alive for the write — and only if the output actually
          // validates against the schema (never cache malformed studies)
          try {
            const parsed = wordStudySchema.safeParse(JSON.parse(fullText));
            if (parsed.success) {
              const study = parsed.data;
              // Normalize segments to exact slices of the requested surface
              // word (not the model's echo of it) so cached entries always
              // render the reader's own text, cantillation intact. A split
              // that doesn't align — wrong, missing, or reordered letters —
              // degrades to no breakdown rather than caching corrupted spans.
              const aligned = alignSegmentsToWord(word, study.morphemes);
              if (aligned) {
                study.morphemes = aligned.map(seg => ({
                  text: seg.text,
                  type: seg.type ?? 'affix',
                  gloss: seg.gloss ?? '',
                }));
              } else {
                study.morphemes = [];
                study.meaningBridge = null;
              }
              // Keep cached citations short and always-highlighted, even
              // when the model quoted a whole verse or skipped the bold.
              // A snippet in which neither the model nor the skeleton
              // matcher can locate the word is an unverifiable citation
              // (the model quoted a thematically similar verse that does
              // not actually contain this root) — drop it entirely.
              study.occurrences = study.occurrences
                .map(occ => ({
                  ...occ,
                  snippet: tightenOccurrenceText(occ.snippet, {
                    word: study.word,
                    root: study.grammar.root,
                  }),
                  translation: tightenOccurrenceText(occ.translation, { before: 6, after: 6 }),
                }))
                .filter(occ => occ.snippet.includes('**'));
              await setCachedExplanation(key, JSON.stringify(study));
            } else {
              console.error('Word study failed schema validation; not caching:', parsed.error.message);
            }
          } catch {
            console.error('Word study was not valid JSON; not caching');
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return jsonTextResponse(stream, 'MISS');
  } catch (error: any) {
    console.error('Word explanation API error:', error);
    return NextResponse.json(
      { error: 'AI service error', message: error.message || 'An unexpected error occurred' },
      { status: 502 }
    );
  }
}
