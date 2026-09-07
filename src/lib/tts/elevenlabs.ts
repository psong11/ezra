/**
 * ElevenLabs text-to-speech.
 *
 * Hebrew works on ONE model: `eleven_v3`. The multilingual_v2 (29 langs)
 * and flash_v2_5 (32 langs) model cards do not list Hebrew, and
 * turbo_v2_5 is deprecated — so `eleven_v3` is not a preference here, it
 * is the only option, and changing MODEL_ID silently breaks Hebrew.
 *
 * `voice_settings` is deliberately not sent: v3 rejects some of the value
 * ranges v2 accepted, and the defaults are what was judged by ear.
 */

const API_ROOT = 'https://api.elevenlabs.io/v1/text-to-speech';
const MODEL_ID = 'eleven_v3';

// mp3_44100_128 keeps the format identical to what the reader already
// plays, so nothing downstream has to care which provider spoke.
const OUTPUT_FORMAT = 'mp3_44100_128';

// v3 caps a single request at 5,000 characters. The longest verse in the
// corpus is far short of that, but a caller could hand us a whole chapter.
const MAX_REQUEST_CHARS = 5000;

export interface ElevenSynthesisParams {
  text: string;
  voiceId: string;
  /** ISO-639-1 ("he", "el"): steers pronunciation for a multilingual voice. */
  languageCode?: string;
}

export class ElevenLabsTTSError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True when the account is out of credits or rate limited, rather
     *  than the request being malformed — the caller can fall back. */
    readonly isQuotaOrRateLimit: boolean
  ) {
    super(message);
    this.name = 'ElevenLabsTTSError';
  }
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export function getElevenVoiceId(): string {
  // Rachel — the voice the provider comparison was judged on.
  return process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
}

export function getElevenModelId(): string {
  return MODEL_ID;
}

export class ElevenLabsTTSClient {
  private apiKey: string;

  constructor(apiKey = process.env.ELEVENLABS_API_KEY) {
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
    this.apiKey = apiKey;
  }

  async synthesize({ text, voiceId, languageCode }: ElevenSynthesisParams): Promise<Buffer> {
    if (text.length > MAX_REQUEST_CHARS) {
      throw new Error(
        `Text is ${text.length} chars; eleven_v3 accepts at most ${MAX_REQUEST_CHARS} per request`
      );
    }

    const res = await fetch(`${API_ROOT}/${voiceId}?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        ...(languageCode ? { language_code: languageCode } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // 401 covers an exhausted quota as well as a bad key; 429 is rate
      // limiting. Both mean "try the other provider", not "give up".
      const isQuotaOrRateLimit = res.status === 429 || res.status === 401;
      throw new ElevenLabsTTSError(
        `ElevenLabs ${res.status} ${res.statusText} — ${body.slice(0, 300)}`,
        res.status,
        isQuotaOrRateLimit
      );
    }

    return Buffer.from(await res.arrayBuffer());
  }
}
