/**
 * GET /api/tts/verse/{version}/{bookId}/{chapter}/{verse}
 *
 * Cacheable per-verse audio for the chapter reader. Addressing a verse by
 * reference rather than by text makes the response immutable, so both the
 * browser and Vercel's CDN can keep it — which is what stopped a burst of
 * uncacheable POSTs tripping Vercel's DDoS mitigation mid-chapter.
 *
 * The {version} segment is the cost of that immutability: nothing else in
 * the URL says which provider, voice, or text treatment produced the
 * audio, so without it a change of any of them would never reach anyone
 * holding a cached copy. See AUDIO_VERSION in lib/tts/verseVoice.ts.
 *
 * Audio is billed per character on ElevenLabs, so the blob-backed cache
 * is not an optimization here — it is the difference between paying once
 * per verse and paying every cold start.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadBook, getVerseText, getBookLanguage } from '@/lib/bibleLoader';
import { getGoogleTTSClient } from '@/lib/tts/google';
import { ElevenLabsTTSClient, ElevenLabsTTSError } from '@/lib/tts/elevenlabs';
import { getCachedVerseAudio, setCachedVerseAudio, verseAudioCacheKey } from '@/lib/tts/audioCache';
import {
  AUDIO_VERSION,
  GOOGLE_VOICES,
  describeVoice,
  resolveProvider,
  type TtsProvider,
} from '@/lib/tts/verseVoice';
import { prepareHebrewForTTS } from '@/lib/hebrewText';

interface RouteParams {
  params: { version: string; bookId: string; chapter: string; verse: string };
}

async function synthesize(
  provider: TtsProvider,
  text: string,
  language: 'hebrew' | 'greek'
): Promise<{ buffer: Buffer; provider: TtsProvider }> {
  if (provider === 'elevenlabs') {
    const { voice, languageCode } = describeVoice('elevenlabs', language);
    try {
      const buffer = await new ElevenLabsTTSClient().synthesize({
        text,
        voiceId: voice,
        languageCode,
      });
      return { buffer, provider: 'elevenlabs' };
    } catch (err) {
      // Running out of credits mid-month must not silence the reader —
      // drop to Google rather than failing the request.
      if (err instanceof ElevenLabsTTSError && err.isQuotaOrRateLimit) {
        console.warn(`ElevenLabs unavailable (${err.status}), falling back to Google:`, err.message);
      } else {
        throw err;
      }
    }
  }

  const google = GOOGLE_VOICES[language];
  const buffer = await getGoogleTTSClient().synthesize({
    text,
    voiceName: google.voiceName,
    languageCode: google.languageCode,
    audioEncoding: 'MP3',
  });
  return { buffer, provider: 'google' };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    if (params.version !== AUDIO_VERSION) {
      // Refuse unknown versions rather than serving them: an open version
      // space would let anything fill the CDN with paid-for audio.
      return NextResponse.json(
        { error: `Unknown audio version "${params.version}" (current: ${AUDIO_VERSION})` },
        { status: 404 }
      );
    }

    const chapter = Number(params.chapter);
    const verse = Number(params.verse);
    if (!Number.isInteger(chapter) || !Number.isInteger(verse)) {
      return NextResponse.json({ error: 'Chapter and verse must be integers' }, { status: 400 });
    }

    const language = getBookLanguage(params.bookId);
    if (!language) {
      return NextResponse.json({ error: `Unknown book: ${params.bookId}` }, { status: 404 });
    }

    let text: string;
    try {
      text = getVerseText(await loadBook(params.bookId), chapter, verse);
    } catch {
      return NextResponse.json(
        { error: `Verse not found: ${params.bookId} ${chapter}:${verse}` },
        { status: 404 }
      );
    }

    // Cantillation marks are chanting notation, not pronunciation. Niqqud
    // are kept: ElevenLabs reads them slightly more expressively, and the
    // 1.72x character cost is a few cents a chapter.
    const inputText = prepareHebrewForTTS(text).trim();
    if (!inputText) {
      return NextResponse.json({ error: 'Verse has no text to speak' }, { status: 404 });
    }

    const provider = resolveProvider();
    const { voice, model, languageCode } = describeVoice(provider, language);
    const cacheKey = verseAudioCacheKey({ text: inputText, provider, voice, model, languageCode });

    const cached = await getCachedVerseAudio(cacheKey);
    let audioBuffer: Buffer;
    let cacheSource: string;
    let servedBy: TtsProvider = provider;

    if (cached) {
      audioBuffer = cached.buffer;
      cacheSource = `HIT-${cached.source}`;
    } else {
      const result = await synthesize(provider, inputText, language);
      audioBuffer = result.buffer;
      servedBy = result.provider;
      cacheSource = 'MISS';
      // Key by whoever actually spoke — a Google fallback must not be
      // cached under the ElevenLabs key and served once credits return.
      const actual = describeVoice(servedBy, language);
      await setCachedVerseAudio(
        verseAudioCacheKey({
          text: inputText,
          provider: servedBy,
          voice: actual.voice,
          model: actual.model,
          languageCode: actual.languageCode,
        }),
        audioBuffer
      );
    }

    return new NextResponse(audioBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'X-Cache': cacheSource,
        'X-TTS-Provider': servedBy,
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
