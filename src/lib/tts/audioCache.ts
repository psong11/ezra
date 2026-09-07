/**
 * Durable cache for synthesized verse audio.
 *
 *   1. In-memory LRU  — instant while a serverless instance is warm
 *   2. Vercel Blob    — survives cold starts, shared by every instance
 *   3. Filesystem     — local-dev stand-in (.tts-cache/) when no token
 *
 * The existing TTSCache is memory-only in production (Vercel's filesystem
 * is read-only) and, worse, its `get()` returns null there even when
 * `has()` said yes — so every production request re-synthesized. That was
 * merely wasteful against Google's free tier. Against ElevenLabs, where
 * characters are billed and the Starter plan allows roughly eleven
 * chapters a month, re-synthesizing audio already paid for is the
 * difference between a working reader and an exhausted quota. Hence a
 * real cache that actually returns bytes in production.
 *
 * Audio of a fixed verse in a fixed voice never changes, so there is no
 * TTL. Every persistence error is logged and swallowed: a cache failure
 * must degrade to a re-synthesis, never to a broken request.
 */

import { createHash } from 'crypto';

const BLOB_PREFIX = 'verse-audio';
const FS_CACHE_DIR = '.tts-cache';
// Buffers, not metadata — a few MB at most, and it is what spares the bill.
const MAX_MEMORY_ENTRIES = 60;

const memory = new Map<string, Buffer>();

export type AudioCacheSource = 'memory' | 'blob' | 'fs' | null;

/**
 * Everything that can change the bytes goes in the key. Provider and voice
 * matter as much as the text: without them, flipping providers would serve
 * the previous voice's audio out of cache forever.
 */
export function verseAudioCacheKey(params: {
  text: string;
  provider: string;
  voice: string;
  model: string;
  languageCode: string;
}): string {
  const raw = [params.provider, params.voice, params.model, params.languageCode, params.text].join('|');
  return createHash('sha256').update(raw.normalize('NFC')).digest('hex');
}

function rememberInMemory(key: string, buffer: Buffer): void {
  if (memory.size >= MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, buffer);
}

function hasBlobStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readFromBlob(key: string): Promise<Buffer | null> {
  const { get } = await import('@vercel/blob');
  const result = await get(`${BLOB_PREFIX}/${key}.mp3`, { access: 'private' });
  if (!result) return null;
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

async function writeToBlob(key: string, buffer: Buffer): Promise<void> {
  const { put } = await import('@vercel/blob');
  await put(`${BLOB_PREFIX}/${key}.mp3`, buffer, {
    access: 'private',
    allowOverwrite: true,
    contentType: 'audio/mpeg',
  });
}

async function readFromFs(key: string): Promise<Buffer | null> {
  try {
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    return await readFile(join(process.cwd(), FS_CACHE_DIR, `${key}.mp3`));
  } catch {
    return null;
  }
}

async function writeToFs(key: string, buffer: Buffer): Promise<void> {
  const { mkdir, writeFile } = await import('fs/promises');
  const { join } = await import('path');
  const dir = join(process.cwd(), FS_CACHE_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${key}.mp3`), buffer);
}

export async function getCachedVerseAudio(
  key: string
): Promise<{ buffer: Buffer; source: AudioCacheSource } | null> {
  const inMemory = memory.get(key);
  if (inMemory) return { buffer: inMemory, source: 'memory' };

  try {
    if (hasBlobStore()) {
      const buffer = await readFromBlob(key);
      if (buffer) {
        rememberInMemory(key, buffer);
        return { buffer, source: 'blob' };
      }
    } else {
      const buffer = await readFromFs(key);
      if (buffer) {
        rememberInMemory(key, buffer);
        return { buffer, source: 'fs' };
      }
    }
  } catch (err) {
    console.error('Verse audio cache read failed:', err);
  }

  return null;
}

export async function setCachedVerseAudio(key: string, buffer: Buffer): Promise<void> {
  rememberInMemory(key, buffer);
  try {
    if (hasBlobStore()) {
      await writeToBlob(key, buffer);
    } else {
      await writeToFs(key, buffer);
    }
  } catch (err) {
    console.error('Verse audio cache write failed:', err);
  }
}
