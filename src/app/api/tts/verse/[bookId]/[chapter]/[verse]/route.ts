/**
 * GET /api/tts/verse/{bookId}/{chapter}/{verse}
 *
 * Cacheable per-verse audio for the chapter reader. The POST /api/tts route
 * still exists for ad-hoc synthesis, but POST responses are cacheable by
 * nobody — not the browser, not Vercel's CDN — so listening to a chapter
 * fired one uncacheable dynamic request per verse, every single time. A
 * burst of those trips Vercel's automatic DDoS mitigation, which answers
 * with a 403 "Security Checkpoint" HTML page; playback then dies mid-chapter
 * and every later verse fails too, because the challenge sticks to the
 * client.
 *
 * Addressing a verse by reference instead of by text makes the response
 * immutable and cacheable: Genesis 8:18 always sounds the same. The browser
 * reuses it on replay and the CDN serves it to everyone else, so the origin
 * sees a handful of requests instead of one per verse per listen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadBook, getVerseText, getBookLanguage } from '@/lib/bibleLoader';
import { getGoogleTTSClient } from '@/lib/tts/google';
import { getTTSCache } from '@/lib/tts/cache';
import { generateCacheKey, getAudioExtension, getAudioMimeType } from '@/lib/tts/hash';
import { prepareHebrewForTTS } from '@/lib/hebrewText';

const VOICES = {
  hebrew: { languageCode: 'he-IL', voiceName: 'he-IL-Wavenet-A' },
  greek: { languageCode: 'el-GR', voiceName: 'el-GR-Wavenet-A' },
} as const;

const AUDIO_ENCODING = 'MP3';

interface RouteParams {
  params: { bookId: string; chapter: string; verse: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const chapter = Number(params.chapter);
    const verse = Number(params.verse);
    if (!Number.isInteger(chapter) || !Number.isInteger(verse)) {
      return NextResponse.json({ error: 'Chapter and verse must be integers' }, { status: 400 });
    }

    const language = getBookLanguage(params.bookId);
    if (!language) {
      return NextResponse.json({ error: `Unknown book: ${params.bookId}` }, { status: 404 });
    }
    const { languageCode, voiceName } = VOICES[language];

    let text: string;
    try {
      text = getVerseText(await loadBook(params.bookId), chapter, verse);
    } catch {
      return NextResponse.json(
        { error: `Verse not found: ${params.bookId} ${chapter}:${verse}` },
        { status: 404 }
      );
    }

    // Cantillation marks are chanting notation, not pronunciation — they
    // confuse the voice, so strip them but keep the vowel points.
    const inputText = prepareHebrewForTTS(text).trim();
    if (!inputText) {
      return NextResponse.json({ error: 'Verse has no text to speak' }, { status: 404 });
    }

    const cacheKey = generateCacheKey({ text: inputText, voiceName, languageCode, audioEncoding: AUDIO_ENCODING });
    const extension = getAudioExtension(AUDIO_ENCODING);
    const mimeType = getAudioMimeType(AUDIO_ENCODING);

    const cache = await getTTSCache();
    let audioBuffer = (await cache.has(cacheKey, extension))
      ? await cache.get(cacheKey, extension)
      : null;

    if (!audioBuffer) {
      audioBuffer = await getGoogleTTSClient().synthesize({
        text: inputText,
        voiceName,
        languageCode,
        audioEncoding: AUDIO_ENCODING,
      });
      await cache.set(cacheKey, extension, audioBuffer, mimeType);
    }

    return new NextResponse(audioBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': audioBuffer.length.toString(),
        // Scripture doesn't change: let the browser and the CDN keep this
        // forever. s-maxage is what actually gets Vercel's edge to serve
        // repeat listeners without waking the function.
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'X-Cache-Key': cacheKey,
      },
    });
  } catch (error: any) {
    console.error('Verse TTS error:', error);
    const isAuthError =
      error?.message?.includes('credentials') || error?.message?.includes('authentication');
    return NextResponse.json(
      {
        error: isAuthError ? 'Authentication required' : 'Failed to generate speech',
        message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
