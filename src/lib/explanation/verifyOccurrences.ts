/**
 * Corpus-grounded citation verification (server-only — reads book JSON).
 *
 * The final rung of the trust ladder: instead of merely checking the
 * model's quote for the studied root, every occurrence is verified against
 * the ACTUAL verse text in our local Bible data, and the snippet is
 * REBUILT from that text. The model contributes only the reference and
 * the translation; the original-language quote a reader sees is always
 * the real verse, with the real target token bolded.
 *
 *   - Reference resolved via resolveReference (hallucinated books/chapters
 *     already fail there).
 *   - The cited verse, then verse+1 and verse-1, are searched for the
 *     word/root — the ±1 tolerance absorbs English-vs-Masoretic
 *     versification drift (Psalm titles count as verse 1 in our corpus).
 *     When a neighbor matches, the occurrence's verse number is corrected
 *     so the link lands on the verified verse.
 *   - No match in any candidate verse → the citation is dropped.
 */

import { Occurrence } from './schema';
import { resolveReference } from './refs';
import { locateTargetToken, tightenOccurrenceText } from './occurrences';

export type VerseLoader = (
  bookId: string,
  chapter: number,
  verse: number
) => Promise<string | null>;

interface VerifyOptions {
  word: string;
  root: string | null | undefined;
  loadVerse?: VerseLoader;
}

async function defaultVerseLoader(): Promise<VerseLoader> {
  const { loadBook } = await import('@/lib/bibleLoader');
  const books = new Map<string, Awaited<ReturnType<typeof loadBook>> | null>();
  return async (bookId, chapter, verse) => {
    if (!books.has(bookId)) {
      try {
        books.set(bookId, await loadBook(bookId));
      } catch {
        books.set(bookId, null);
      }
    }
    const book = books.get(bookId);
    if (!book) return null;
    const chapterData = book.chapters.find(c => c.chapter === chapter);
    return chapterData?.verses.find(v => v.verse === verse)?.text ?? null;
  };
}

export async function verifyOccurrencesAgainstCorpus(
  occurrences: Occurrence[],
  options: VerifyOptions
): Promise<Occurrence[]> {
  const { word, root } = options;
  const loadVerse = options.loadVerse ?? (await defaultVerseLoader());

  const verified: Occurrence[] = [];
  for (const occ of occurrences) {
    const resolved = resolveReference(occ.book, occ.chapter, occ.verse);
    if (!resolved || resolved.verse === undefined) continue;

    const candidates = [resolved.verse, resolved.verse + 1, resolved.verse - 1].filter(v => v >= 1);
    for (const candidate of candidates) {
      const text = await loadVerse(resolved.bookId, resolved.chapter, candidate);
      if (!text) continue;

      const tokens = text.split(/\s+/).filter(Boolean);
      const target = locateTargetToken(tokens, word, root);
      if (target === -1) continue;

      tokens[target] = `**${tokens[target]}**`;
      verified.push({
        ...occ,
        verse: candidate,
        snippet: tightenOccurrenceText(tokens.join(' '), { word, root }),
        translation: tightenOccurrenceText(occ.translation, { before: 6, after: 6 }),
      });
      break;
    }
  }
  return verified;
}
