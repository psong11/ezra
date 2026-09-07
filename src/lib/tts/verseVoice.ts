/**
 * Which provider and voice speak a given book.
 *
 * The URL version marker that makes a change of either actually reach
 * listeners lives in ./audioVersion, which has no imports so client code
 * can read it without pulling provider modules into the bundle.
 */

import { getElevenVoiceId, getElevenModelId, isElevenLabsConfigured } from './elevenlabs';

export { AUDIO_VERSION } from './audioVersion';

export type TtsProvider = 'google' | 'elevenlabs';

export const GOOGLE_VOICES = {
  hebrew: { languageCode: 'he-IL', voiceName: 'he-IL-Wavenet-A' },
  greek: { languageCode: 'el-GR', voiceName: 'el-GR-Wavenet-A' },
} as const;

/** ISO-639-1, which is what ElevenLabs wants (not the BCP-47 Google uses). */
export const SHORT_LANG = { hebrew: 'he', greek: 'el' } as const;

/**
 * ElevenLabs is the default because it was judged markedly better by ear;
 * TTS_PROVIDER=google is the escape hatch when the month's credits run
 * out or the bill needs to stop. Missing credentials fall back silently
 * rather than breaking playback.
 */
export function resolveProvider(): TtsProvider {
  const configured = (process.env.TTS_PROVIDER || 'elevenlabs').toLowerCase();
  if (configured === 'google') return 'google';
  return isElevenLabsConfigured() ? 'elevenlabs' : 'google';
}

export function describeVoice(provider: TtsProvider, language: 'hebrew' | 'greek') {
  if (provider === 'elevenlabs') {
    return {
      voice: getElevenVoiceId(),
      model: getElevenModelId(),
      languageCode: SHORT_LANG[language],
    };
  }
  return {
    voice: GOOGLE_VOICES[language].voiceName,
    model: 'google-tts',
    languageCode: GOOGLE_VOICES[language].languageCode,
  };
}
