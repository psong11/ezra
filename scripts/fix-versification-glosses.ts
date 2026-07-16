import fs from 'fs';
import path from 'path';
import https from 'https';

/**
 * Fix word-gloss gaps caused by versification mismatches.
 *
 * TAHOT refs use English (KJV) versification, but where the Hebrew
 * (Masoretic) numbering differs, the ref carries it in parentheses:
 *
 *   Hos.1.10(2.1)#01=L   → English Hosea 1:10 = Hebrew Hosea 2:1
 *   Psa.3.0(3.1)#01=L    → Psalm titles: English "verse 0" = Hebrew verse 1
 *
 * Our text uses Masoretic numbering, but the original import keyed
 * glosses by the English ref, so every divergent span (all titled
 * Psalms, Hosea 2, Joel 3-4, Jonah 2, Malachi 3, ...) ended up with
 * empty glosses. This script re-keys by the Hebrew ref (parenthetical
 * when present) and re-runs the same word alignment.
 *
 * Safety: a verse's wordTranslations are only replaced when the new
 * alignment fills STRICTLY MORE glosses than what's stored, so good
 * existing data can never be degraded.
 *
 * Usage:
 *   npx tsx scripts/fix-versification-glosses.ts [--write] [--book hosea] [--from-dir /path/to/tahot/files]
 *
 * Default is a dry run (prints what would change). Pass --write to save.
 * NOTE: the manuscript-variant parens AFTER '#' (e.g. "#09=Q(K)",
 * "#20=L(abh)") are unrelated to versification and are ignored.
 */

interface WordTranslation {
  word: string;
  translation: string;
  transliteration?: string;
}

interface BibleVerse {
  verse: number;
  text: string;
  words?: string[];
  wordTranslations?: WordTranslation[];
}

interface BibleChapter {
  chapter: number;
  verses: BibleVerse[];
}

interface BibleBook {
  book: unknown;
  chapters: BibleChapter[];
}

// Same book-code map as import-all-books.ts (Hebrew only — Greek has no
// versification divergence and is untouched by this script).
const HEBREW_BOOK_MAP: Record<string, string> = {
  Gen: 'genesis', Exo: 'exodus', Lev: 'leviticus', Num: 'numbers', Deu: 'deuteronomy',
  Jos: 'joshua', Jdg: 'judges', Rut: 'ruth',
  '1Sa': '1-samuel', '2Sa': '2-samuel', '1Ki': '1-kings', '2Ki': '2-kings',
  '1Ch': '1-chronicles', '2Ch': '2-chronicles',
  Ezr: 'ezra', Neh: 'nehemiah', Est: 'esther',
  Job: 'job', Psa: 'psalms', Pro: 'proverbs', Ecc: 'ecclesiastes', Sng: 'song-of-songs',
  Isa: 'isaiah', Jer: 'jeremiah', Lam: 'lamentations', Ezk: 'ezekiel', Dan: 'daniel',
  Hos: 'hosea', Jol: 'joel', Amo: 'amos', Oba: 'obadiah', Jon: 'jonah', Mic: 'micah',
  Nah: 'nahum', Nam: 'nahum', Hab: 'habakkuk', Zep: 'zephaniah', Hag: 'haggai',
  Zec: 'zechariah', Mal: 'malachi',
};

const TAHOT_FILES = ['Gen-Deu', 'Jos-Est', 'Job-Sng', 'Isa-Mal'].map(
  range =>
    `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20${range}%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt`
);

function downloadFile(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Parse one TAHOT word line, keyed by HEBREW (Masoretic) versification.
 * Ref format: Book.engCh.engVerse[(hebCh.hebVerse)]#wordNum=manuscript
 */
function parseLine(
  line: string
): { book: string; chapter: number; verse: number; word: WordTranslation } | null {
  const parts = line.split('\t');
  if (parts.length < 4) return null;

  const ref = parts[0];
  // The '#' requirement keeps us on word lines and ensures the optional
  // parenthetical we capture is the versification one (before '#'), not
  // the manuscript flags after it.
  const match = ref.match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?#/);
  if (!match) return null;

  const book = match[1];
  // Hebrew numbering: parenthetical when present, primary otherwise.
  const chapter = match[4] ? parseInt(match[4]) : parseInt(match[2]);
  const verse = match[5] ? parseInt(match[5]) : parseInt(match[3]);

  const originalWord = parts[1];
  const transliteration = parts[2];
  const translation = parts[3];

  // Same cleaning as import-all-books.ts so recomputed alignments are
  // byte-identical for verses that were already correct.
  const cleanTranslation = translation.replace(/\//g, '').trim();
  const finalTranslation = cleanTranslation
    .replace(/<[^>]*>/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();
  const cleanWord = originalWord.split(/[\\]/)[0] || originalWord;

  return {
    book,
    chapter,
    verse,
    word: {
      word: cleanWord,
      translation: finalTranslation || cleanTranslation,
      transliteration: transliteration.replace(/\//g, ''),
    },
  };
}

// ─── Word matching: identical to import-all-books.ts ───────────────────

function normalizeWord(word: string | { _: string }): string {
  if (!word) return '';
  const wordText = typeof word === 'object' && word !== null && '_' in word ? word._ : word;
  return String(wordText)
    .replace(/[,\.\;\:\!\?\—\-\'\"\(\)\[\]]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findMatchingTranslation(
  word: string,
  stepBibleWords: WordTranslation[],
  usedIndices: Set<number>
): WordTranslation | null {
  const normalizedWord = normalizeWord(word);

  for (let i = 0; i < stepBibleWords.length; i++) {
    if (usedIndices.has(i)) continue;
    if (normalizedWord === normalizeWord(stepBibleWords[i].word)) {
      usedIndices.add(i);
      return stepBibleWords[i];
    }
  }

  for (let i = 0; i < stepBibleWords.length; i++) {
    if (usedIndices.has(i)) continue;
    if (normalizedWord === normalizeWord(stepBibleWords[i].word.replace(/\//g, ''))) {
      usedIndices.add(i);
      return stepBibleWords[i];
    }
  }

  for (let i = 0; i < stepBibleWords.length; i++) {
    if (usedIndices.has(i)) continue;
    const normalizedStepWord = normalizeWord(stepBibleWords[i].word.replace(/\//g, ''));
    if (normalizedStepWord.length >= 3 && normalizedWord.includes(normalizedStepWord)) {
      usedIndices.add(i);
      return stepBibleWords[i];
    }
  }

  if (normalizedWord.length >= 4) {
    for (let i = 0; i < stepBibleWords.length; i++) {
      if (usedIndices.has(i)) continue;
      const normalizedStepWord = normalizeWord(stepBibleWords[i].word.replace(/\//g, ''));
      if (normalizedStepWord.length >= 3 && normalizedWord.endsWith(normalizedStepWord)) {
        usedIndices.add(i);
        return stepBibleWords[i];
      }
    }
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────

function alignVerse(verse: BibleVerse, stepBibleWords: WordTranslation[]): WordTranslation[] {
  const actualWords = verse.words || verse.text.split(/\s+/);
  const aligned: WordTranslation[] = [];
  const usedIndices = new Set<number>();

  for (const word of actualWords) {
    const wordText =
      typeof word === 'object' && word !== null && '_' in word ? (word as { _: string })._ : word;
    const wordStr = String(wordText);
    const match = findMatchingTranslation(wordStr, stepBibleWords, usedIndices);
    aligned.push(match ?? { word: wordStr, translation: '', transliteration: '' });
  }

  return aligned;
}

function filledCount(translations: WordTranslation[] | undefined): number {
  return (translations ?? []).filter(t => t.translation && t.translation.trim()).length;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const bookFilterIdx = args.indexOf('--book');
  const bookFilter = bookFilterIdx >= 0 ? args[bookFilterIdx + 1] : null;
  const fromDirIdx = args.indexOf('--from-dir');
  const fromDir = fromDirIdx >= 0 ? args[fromDirIdx + 1] : null;

  console.log(`Mode: ${write ? 'WRITE' : 'DRY RUN'}${bookFilter ? ` (book: ${bookFilter})` : ''}\n`);

  // bookCode -> "hebChapter:hebVerse" -> words
  const bookData = new Map<string, Map<string, WordTranslation[]>>();

  for (let i = 0; i < TAHOT_FILES.length; i++) {
    let content: string;
    if (fromDir) {
      const ranges = ['gen-deu', 'jos-est', 'job-sng', 'isa-mal'];
      const localPath = path.join(fromDir, `tahot-${ranges[i]}.txt`);
      console.log(`Reading ${localPath}`);
      content = fs.readFileSync(localPath, 'utf-8');
    } else {
      console.log(`Downloading file ${i + 1}/${TAHOT_FILES.length}...`);
      content = await downloadFile(TAHOT_FILES[i]);
    }

    for (const line of content.split('\n')) {
      const result = parseLine(line);
      if (!result) continue;
      if (!bookData.has(result.book)) bookData.set(result.book, new Map());
      const verseMap = bookData.get(result.book)!;
      const key = `${result.chapter}:${result.verse}`;
      if (!verseMap.has(key)) verseMap.set(key, []);
      verseMap.get(key)!.push(result.word);
    }
  }

  console.log(`\nParsed ${bookData.size} books from TAHOT\n`);

  let totalImproved = 0;
  let totalGlossesGained = 0;

  for (const [bookCode, verseMap] of bookData.entries()) {
    const bookId = HEBREW_BOOK_MAP[bookCode];
    if (!bookId) continue;
    if (bookFilter && bookId !== bookFilter) continue;

    const bookPath = path.join(process.cwd(), 'src', 'data', 'bible', 'hebrew', `${bookId}.json`);
    if (!fs.existsSync(bookPath)) {
      console.log(`⚠️  missing file: ${bookId}.json`);
      continue;
    }

    const data: BibleBook = JSON.parse(fs.readFileSync(bookPath, 'utf-8'));
    let improved = 0;
    let glossesGained = 0;
    const samples: string[] = [];

    for (const chapter of data.chapters) {
      for (const verse of chapter.verses) {
        const stepBibleWords = verseMap.get(`${chapter.chapter}:${verse.verse}`);
        if (!stepBibleWords || stepBibleWords.length === 0) continue;

        const oldFilled = filledCount(verse.wordTranslations);
        const aligned = alignVerse(verse, stepBibleWords);
        const newFilled = filledCount(aligned);

        // Only ever replace when strictly better — existing good data is safe.
        if (newFilled > oldFilled) {
          if (write) verse.wordTranslations = aligned;
          improved++;
          glossesGained += newFilled - oldFilled;
          if (samples.length < 3) {
            samples.push(`${chapter.chapter}:${verse.verse} ${oldFilled}→${newFilled}`);
          }
        }
      }
    }

    if (improved > 0) {
      console.log(
        `${write ? '✏️ ' : '👀'} ${bookId.padEnd(15)} ${String(improved).padStart(4)} verses improved, +${glossesGained} glosses  (e.g. ${samples.join(', ')})`
      );
      totalImproved += improved;
      totalGlossesGained += glossesGained;
      if (write) fs.writeFileSync(bookPath, JSON.stringify(data, null, 2));
    }
  }

  console.log(`\n${write ? 'Wrote' : 'Would write'}: ${totalImproved} verses improved, +${totalGlossesGained} glosses`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
