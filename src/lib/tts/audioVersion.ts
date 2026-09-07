/**
 * Version marker for verse-audio URLs. Its own module with no imports so
 * the client bundle can read it without dragging in provider code.
 *
 * LOAD-BEARING. Verse audio is served from
 * /api/tts/verse/{version}/{book}/{chapter}/{verse} under a one-year
 * immutable Cache-Control, so the CDN and every browser key on the URL
 * alone — which says nothing about the provider, voice, or text treatment
 * behind it. Bump this whenever any of those change, or listeners keep
 * the old audio for up to a year. Same discipline as KEY_VERSION in the
 * explanation cache.
 *
 * v1: Google he-IL-Wavenet-A / el-GR-Wavenet-A, niqqud kept.
 * v2: ElevenLabs eleven_v3 for Hebrew (judged clearly more natural), niqqud
 *     kept — pointed reads a little more expressively, and the 1.72x
 *     character cost is roughly 19 cents a chapter.
 */
export const AUDIO_VERSION = 'v2';
