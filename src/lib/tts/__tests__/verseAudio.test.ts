import { describe, it, expect, afterEach } from 'vitest';
import { ElevenLabsTTSError } from '../elevenlabs';
import { verseAudioCacheKey } from '../audioCache';
import { AUDIO_VERSION } from '../audioVersion';
import { resolveProvider, describeVoice, GOOGLE_VOICES } from '../verseVoice';

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('ElevenLabsTTSError', () => {
  // The reader must survive the month's credits running out mid-chapter,
  // so "out of credits" has to be distinguishable from "bad request".
  it('flags a 429 as recoverable so the caller falls back', () => {
    expect(new ElevenLabsTTSError('rate limited', 429, true).isQuotaOrRateLimit).toBe(true);
  });

  it('flags a 401 as recoverable — an exhausted quota reads as unauthorized', () => {
    expect(new ElevenLabsTTSError('unauthorized', 401, true).isQuotaOrRateLimit).toBe(true);
  });

  it('does not flag a malformed request, which falling back would only repeat', () => {
    expect(new ElevenLabsTTSError('bad voice', 422, false).isQuotaOrRateLimit).toBe(false);
  });
});

describe('verseAudioCacheKey', () => {
  const base = {
    text: 'בְּרֵאשִׁית',
    provider: 'elevenlabs',
    voice: '21m00Tcm4TlvDq8ikWAM',
    model: 'eleven_v3',
    languageCode: 'he',
  };

  it('is stable for identical inputs', () => {
    expect(verseAudioCacheKey(base)).toBe(verseAudioCacheKey({ ...base }));
  });

  // Without provider and voice in the key, flipping providers would serve
  // the previous voice out of cache forever — the exact bug the handoff
  // warned about for generateCacheKey.
  it('separates providers', () => {
    expect(verseAudioCacheKey({ ...base, provider: 'google' })).not.toBe(verseAudioCacheKey(base));
  });

  it('separates voices', () => {
    expect(verseAudioCacheKey({ ...base, voice: 'other' })).not.toBe(verseAudioCacheKey(base));
  });

  it('separates text treatments (pointed vs bare)', () => {
    expect(verseAudioCacheKey({ ...base, text: 'בראשית' })).not.toBe(verseAudioCacheKey(base));
  });
});

describe('resolveProvider', () => {
  it('uses ElevenLabs by default when a key is present', () => {
    delete process.env.TTS_PROVIDER;
    process.env.ELEVENLABS_API_KEY = 'test-key';
    expect(resolveProvider()).toBe('elevenlabs');
  });

  it('honours TTS_PROVIDER=google as the escape hatch', () => {
    process.env.TTS_PROVIDER = 'google';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    expect(resolveProvider()).toBe('google');
  });

  // Playback must never break just because a credential is absent.
  it('falls back to Google when no ElevenLabs key is configured', () => {
    delete process.env.TTS_PROVIDER;
    delete process.env.ELEVENLABS_API_KEY;
    expect(resolveProvider()).toBe('google');
  });
});

describe('describeVoice', () => {
  it('gives ElevenLabs the short ISO code, not the BCP-47 one Google wants', () => {
    expect(describeVoice('elevenlabs', 'hebrew').languageCode).toBe('he');
    expect(describeVoice('google', 'hebrew').languageCode).toBe(GOOGLE_VOICES.hebrew.languageCode);
  });
});

describe('AUDIO_VERSION', () => {
  // A bare reminder that this is not decoration: the URL is the only thing
  // the CDN keys on, so a provider change without a bump is invisible.
  it('is a non-empty marker', () => {
    expect(AUDIO_VERSION).toMatch(/^v\d+$/);
  });
});
