#!/usr/bin/env node
/**
 * A/B the Hebrew TTS options so the choice is made by ear, not by guesswork.
 *
 * Two axes, four files per verse:
 *
 *   provider   google  (he-IL-Wavenet-A, what the reader ships today)
 *              eleven  (eleven_v3 — the only ElevenLabs model that lists
 *                       Hebrew at all; multilingual_v2 and flash_v2_5 do not)
 *
 *   treatment  pointed (cantillation stripped, niqqud kept — exactly what
 *                       prepareHebrewForTTS sends in production)
 *              bare    (every diacritic stripped, i.e. how Modern Hebrew is
 *                       actually written, and how these voices were trained)
 *
 * The second axis is the real unknown. Nobody documents whether a Modern
 * Hebrew voice reads niqqud as vowels, ignores them, or trips over them.
 * It is also a billing question: niqqud are separate Unicode codepoints and
 * ElevenLabs charges per character, so pointed text costs roughly double.
 * The summary table prints both counts so the tradeoff is visible.
 *
 *   npx tsx scripts/compare-hebrew-tts.ts
 *   npx tsx scripts/compare-hebrew-tts.ts genesis:1:1 psalms:22:2
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as os from 'os';
import { mkdir, writeFile } from 'fs/promises';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { loadBook, getVerseText } from '../src/lib/bibleLoader';
import { prepareHebrewForTTS, removeAllDiacritics } from '../src/lib/hebrewText';
import { GoogleTTSClient } from '../src/lib/tts/google';

// Defaulted into the OS temp dir rather than a session scratchpad: the
// previous default pointed at one particular agent session's folder, which
// stops existing the moment that session ends.
const OUT_DIR =
  process.env.TTS_COMPARE_OUT || path.join(os.tmpdir(), 'ezra-tts-compare');

// Genesis 1:1 is the baseline everyone knows by ear. Psalm 22:2 is the
// stress test: gutturals, a doubled vowel, and the aramaic-flavoured
// שְׁבַקְתָּנִי that a modern voice has no reason to have seen.
const DEFAULT_REFS = ['genesis:1:1', 'psalms:22:2'];

const GOOGLE_VOICE = { languageCode: 'he-IL', voiceName: 'he-IL-Wavenet-A' };

const ELEVEN_MODEL = 'eleven_v3';
// Overridable — a voice trained on a warmer read may suit scripture better.
// `npx tsx scripts/compare-hebrew-tts.ts --voices` lists what the account has.
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

type Treatment = 'pointed' | 'bare';

interface Row {
  ref: string;
  treatment: Treatment;
  chars: number;
  google: string | null;
  eleven: string | null;
  error?: string;
}

async function listElevenVoices(apiKey: string): Promise<void> {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) {
    throw new Error(`Listing voices failed: ${res.status} ${await res.text()}`);
  }
  const { voices } = (await res.json()) as { voices: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> };
  console.log(`\n${voices.length} voices on this account:\n`);
  for (const v of voices) {
    const labels = v.labels ? Object.values(v.labels).join(', ') : '';
    console.log(`  ${v.voice_id}  ${v.name.padEnd(20)} ${labels}`);
  }
  console.log('\nRe-run with ELEVENLABS_VOICE_ID=<id> to use one of these.\n');
}

async function synthesizeEleven(apiKey: string, text: string): Promise<Buffer> {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}` +
    `?output_format=mp3_44100_128`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    // voice_settings is deliberately omitted: v3 rejects some of the value
    // ranges v2 accepted, and the defaults are what we want to judge anyway.
    body: JSON.stringify({ text, model_id: ELEVEN_MODEL, language_code: 'he' }),
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function slug(ref: string): string {
  return ref.replace(/:/g, '-');
}

async function main() {
  const args = process.argv.slice(2);

  // The Google half needs no credential and answers the question that
  // matters most on its own — whether a Modern Hebrew voice wants niqqud
  // at all. Gating it behind the paid provider's key meant the free,
  // already-shipped half of the comparison could never be heard.
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log(
      '\nℹ️  ELEVENLABS_API_KEY is not set — rendering the Google half only.\n' +
        '   Add it to .env.local to include ElevenLabs (the key lives in the\n' +
        '   vayomer project on petsi).\n'
    );
  }

  if (args.includes('--voices')) {
    if (!apiKey) {
      console.error('❌ --voices lists the ElevenLabs account and needs ELEVENLABS_API_KEY.\n');
      process.exit(1);
    }
    await listElevenVoices(apiKey);
    return;
  }

  const refs = args.length > 0 ? args : DEFAULT_REFS;
  await mkdir(OUT_DIR, { recursive: true });

  const google = new GoogleTTSClient();
  const rows: Row[] = [];

  for (const ref of refs) {
    const [bookId, chapterRaw, verseRaw] = ref.split(':');
    const chapter = Number(chapterRaw);
    const verse = Number(verseRaw);
    if (!bookId || !Number.isInteger(chapter) || !Number.isInteger(verse)) {
      console.error(`⚠️  Skipping malformed reference "${ref}" (want book:chapter:verse)`);
      continue;
    }

    const raw = getVerseText(await loadBook(bookId), chapter, verse);
    console.log(`\n📖 ${bookId} ${chapter}:${verse}`);
    console.log(`   ${raw}`);

    const treatments: Record<Treatment, string> = {
      pointed: prepareHebrewForTTS(raw).trim(),
      bare: removeAllDiacritics(raw).trim(),
    };

    for (const [treatment, text] of Object.entries(treatments) as [Treatment, string][]) {
      const row: Row = { ref, treatment, chars: text.length, google: null, eleven: null };
      console.log(`\n   ── ${treatment} (${text.length} chars)`);
      console.log(`      ${text}`);

      try {
        const buf = await google.synthesize({ ...GOOGLE_VOICE, text, audioEncoding: 'MP3' });
        const file = path.join(OUT_DIR, `${slug(ref)}__google__${treatment}.mp3`);
        await writeFile(file, buf);
        row.google = file;
        console.log(`      ✅ google  → ${path.basename(file)}`);
      } catch (err: any) {
        row.error = `google: ${err.message}`;
        console.log(`      ❌ google  — ${err.message}`);
      }

      // A deliberate skip is not a failure — it must not colour row.error,
      // or the run reports as broken when it did everything it was asked.
      if (!apiKey) {
        console.log('      ⏭  eleven  — skipped (no API key)');
      } else {
        try {
          const buf = await synthesizeEleven(apiKey, text);
          const file = path.join(OUT_DIR, `${slug(ref)}__eleven__${treatment}.mp3`);
          await writeFile(file, buf);
          row.eleven = file;
          console.log(`      ✅ eleven  → ${path.basename(file)}`);
        } catch (err: any) {
          row.error = [row.error, `eleven: ${err.message}`].filter(Boolean).join(' | ');
          console.log(`      ❌ eleven  — ${err.message}`);
        }
      }

      rows.push(row);
    }
  }

  // The cost line is the part that is easy to miss until the bill arrives.
  const pointedChars = rows.filter(r => r.treatment === 'pointed').reduce((n, r) => n + r.chars, 0);
  const bareChars = rows.filter(r => r.treatment === 'bare').reduce((n, r) => n + r.chars, 0);
  const ratio = bareChars > 0 ? pointedChars / bareChars : 0;

  console.log('\n' + '─'.repeat(60));
  console.log(`Files in ${OUT_DIR}`);
  console.log(`\nCharacter cost (ElevenLabs bills per character, niqqud included):`);
  console.log(`  pointed  ${pointedChars} chars`);
  console.log(`  bare     ${bareChars} chars`);
  console.log(`  pointed text costs ${ratio.toFixed(2)}× as much as bare`);
  console.log(
    `\nAt $0.10/1k chars, voicing the whole Tanakh (~1.2M bare chars)` +
      ` runs roughly $${(120 * ratio).toFixed(0)} pointed vs $120 bare.`
  );
  console.log('─'.repeat(60) + '\n');

  const failures = rows.filter(r => r.error);
  if (failures.length > 0) {
    console.log(`⚠️  ${failures.length} of ${rows.length} combinations failed — see above.\n`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('\n❌ ' + (err?.stack || err?.message || err) + '\n');
  process.exit(1);
});
