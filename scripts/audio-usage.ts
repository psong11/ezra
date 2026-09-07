#!/usr/bin/env node
/**
 * What has actually been listened to.
 *
 * Vercel Web Analytics on Hobby gives page views only — custom events are
 * a Pro feature — so it can say a chapter page was *opened* but never that
 * anyone pressed play. The blob store can: a `verse-audio/` entry exists
 * only because someone triggered a real synthesis. That is stronger signal
 * than a page view, it is retained forever rather than for a one-month
 * reporting window, and it costs nothing.
 *
 * The wrinkle is that cache keys are SHA-256 hashes, so a blob listing on
 * its own is anonymous. Every possible key is cheap to recompute, though —
 * 23k verses times a handful of provider/voice combinations — so this
 * builds the reverse map and names each verse.
 *
 *   npm run audio-usage              # what's been played, by book
 *   npm run audio-usage -- --verses  # every individual verse
 *   npm run audio-usage -- --warm genesis:1
 *                                    # pre-synthesize a chapter so the
 *                                    # first real listener doesn't wait
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { loadBook, getBookLanguage } from '../src/lib/bibleLoader';
import { prepareHebrewForTTS } from '../src/lib/hebrewText';
import { verseAudioCacheKey } from '../src/lib/tts/audioCache';
import { AUDIO_VERSION } from '../src/lib/tts/audioVersion';
import { GOOGLE_VOICES, SHORT_LANG } from '../src/lib/tts/verseVoice';

const BLOB_PREFIX = 'verse-audio';

const BOOK_IDS = [
  'genesis','exodus','leviticus','numbers','deuteronomy','joshua','judges','ruth',
  '1-samuel','2-samuel','1-kings','2-kings','1-chronicles','2-chronicles','ezra',
  'nehemiah','esther','job','psalms','proverbs','ecclesiastes','song-of-songs',
  'isaiah','jeremiah','lamentations','ezekiel','daniel','hosea','joel','amos',
  'obadiah','jonah','micah','nahum','habakkuk','zephaniah','haggai','zechariah','malachi',
  'matthew','mark','luke','john','acts','romans','1-corinthians','2-corinthians',
  'galatians','ephesians','philippians','colossians','1-thessalonians','2-thessalonians',
  '1-timothy','2-timothy','titus','philemon','hebrews','james','1-peter','2-peter',
  '1-john','2-john','3-john','jude','revelation',
];

interface VerseId {
  bookId: string;
  chapter: number;
  verse: number;
  provider: string;
}

/**
 * Both providers, because the point is to see what was actually spent —
 * including verses served by the Google fallback after credits ran out.
 */
function keysForVerse(bookId: string, language: 'hebrew' | 'greek', text: string) {
  const eleven = {
    provider: 'elevenlabs',
    voice: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
    model: 'eleven_v3',
    languageCode: SHORT_LANG[language],
  };
  const google = {
    provider: 'google',
    voice: GOOGLE_VOICES[language].voiceName,
    model: 'google-tts',
    languageCode: GOOGLE_VOICES[language].languageCode,
  };
  return [eleven, google].map(v => ({ provider: v.provider, key: verseAudioCacheKey({ ...v, text }) }));
}

async function buildReverseMap(): Promise<Map<string, VerseId>> {
  const map = new Map<string, VerseId>();
  for (const bookId of BOOK_IDS) {
    const language = getBookLanguage(bookId);
    if (!language) continue;
    let book;
    try {
      book = await loadBook(bookId);
    } catch {
      continue;
    }
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        const text = prepareHebrewForTTS(verse.text).trim();
        if (!text) continue;
        for (const { provider, key } of keysForVerse(bookId, language, text)) {
          map.set(key, { bookId, chapter: chapter.chapter, verse: verse.verse, provider });
        }
      }
    }
  }
  return map;
}

async function listBlobs() {
  const { list } = await import('@vercel/blob');
  const out: { pathname: string; size: number; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${BLOB_PREFIX}/`, cursor, limit: 1000 });
    out.push(...page.blobs.map(b => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt })));
    cursor = page.cursor;
  } while (cursor);
  return out;
}

async function warmChapter(ref: string): Promise<void> {
  const [bookId, chapterRaw] = ref.split(':');
  const chapter = Number(chapterRaw);
  const base = process.env.WARM_BASE_URL || 'http://localhost:3333';
  const book = await loadBook(bookId);
  const chapterData = book.chapters.find(c => c.chapter === chapter);
  if (!chapterData) throw new Error(`No such chapter: ${ref}`);

  console.log(`\n🔥 Warming ${bookId} ${chapter} (${chapterData.verses.length} verses) via ${base}`);
  let synthesized = 0;
  for (const v of chapterData.verses) {
    const url = `${base}/api/tts/verse/${AUDIO_VERSION}/${bookId}/${chapter}/${v.verse}`;
    const res = await fetch(url);
    const cache = res.headers.get('x-cache') ?? '?';
    const provider = res.headers.get('x-tts-provider') ?? '?';
    if (cache === 'MISS') synthesized++;
    console.log(`   v${String(v.verse).padStart(3)}  ${res.status}  ${cache.padEnd(11)} ${provider}`);
  }
  console.log(`\n   ${synthesized} newly synthesized, ${chapterData.verses.length - synthesized} already cached.`);
}

async function main() {
  const args = process.argv.slice(2);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('\n❌ BLOB_READ_WRITE_TOKEN is not set — that token is where the usage data lives.\n');
    process.exit(1);
  }

  const warmIdx = args.indexOf('--warm');
  if (warmIdx !== -1) {
    const ref = args[warmIdx + 1];
    if (!ref || !ref.includes(':')) {
      console.error('❌ --warm needs a chapter, e.g. --warm genesis:1\n');
      process.exit(1);
    }
    await warmChapter(ref);
    return;
  }

  console.log('Reading the blob store…');
  const [blobs, reverse] = await Promise.all([listBlobs(), buildReverseMap()]);

  const byBook = new Map<string, { verses: number; bytes: number; providers: Set<string>; first: Date; last: Date }>();
  const named: { id: VerseId; size: number; uploadedAt: Date }[] = [];
  let unknown = 0;
  let totalBytes = 0;

  for (const blob of blobs) {
    totalBytes += blob.size;
    const hash = path.basename(blob.pathname).replace(/\.mp3$/, '');
    const id = reverse.get(hash);
    if (!id) {
      // A hash with no match is audio from a retired voice or treatment —
      // paid for, no longer reachable, and safe to delete.
      unknown++;
      continue;
    }
    named.push({ id, size: blob.size, uploadedAt: blob.uploadedAt });
    const entry = byBook.get(id.bookId) ?? {
      verses: 0, bytes: 0, providers: new Set<string>(),
      first: blob.uploadedAt, last: blob.uploadedAt,
    };
    entry.verses++;
    entry.bytes += blob.size;
    entry.providers.add(id.provider);
    if (blob.uploadedAt < entry.first) entry.first = blob.uploadedAt;
    if (blob.uploadedAt > entry.last) entry.last = blob.uploadedAt;
    byBook.set(id.bookId, entry);
  }

  if (args.includes('--verses')) {
    console.log('\nEvery verse ever played:\n');
    named
      .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())
      .forEach(({ id, uploadedAt }) => {
        console.log(
          `  ${uploadedAt.toISOString().slice(0, 16).replace('T', ' ')}  ` +
            `${id.bookId} ${id.chapter}:${id.verse}  (${id.provider})`
        );
      });
  }

  console.log('\n' + '─'.repeat(64));
  console.log('Verses played, by book\n');
  if (byBook.size === 0) {
    console.log('  (nothing yet)');
  }
  [...byBook.entries()]
    .sort((a, b) => b[1].verses - a[1].verses)
    .forEach(([bookId, e]) => {
      console.log(
        `  ${bookId.padEnd(16)} ${String(e.verses).padStart(5)} verses  ` +
          `${(e.bytes / 1024 / 1024).toFixed(1).padStart(5)} MB  ` +
          `${[...e.providers].join('+').padEnd(20)} last ${e.last.toISOString().slice(0, 10)}`
      );
    });

  console.log('\n' + '─'.repeat(64));
  console.log(`  ${named.length} verses cached across ${byBook.size} books`);
  console.log(`  ${(totalBytes / 1024 / 1024).toFixed(1)} MB in the blob store`);
  if (unknown > 0) {
    console.log(
      `  ${unknown} orphaned (a retired voice or treatment — paid for, no longer served)`
    );
  }
  console.log('\n  These are real plays, not page views: a file exists only');
  console.log('  because someone triggered the synthesis.');
  console.log('─'.repeat(64) + '\n');
}

main().catch(err => {
  console.error('\n❌', err.message, '\n');
  process.exit(1);
});
