/**
 * Resolves model-reported Bible references ("Genesis", "1 Sam", "Psalm 82")
 * to real book ids and validated chapter numbers. Returns null for anything
 * that can't be resolved confidently — callers degrade to plain text, so a
 * hallucinated reference can never produce a broken link.
 */

import { BIBLE_BOOKS } from '@/data/bibleBooks';

const ALIASES: Record<string, string> = {
  'psalm': 'psalms',
  'song of solomon': 'song-of-songs',
  'songs of solomon': 'song-of-songs',
  'canticles': 'song-of-songs',
  'qoheleth': 'ecclesiastes',
  'apocalypse': 'revelation',
  'revelation of john': 'revelation',
};

export interface ResolvedReference {
  bookId: string;
  chapter: number;
  verse?: number;
  label: string;
}

export function resolveReference(
  book: string | undefined,
  chapter: number | undefined,
  verse?: number
): ResolvedReference | null {
  if (!book || typeof chapter !== 'number' || !Number.isInteger(chapter)) return null;

  const norm = book.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  if (!norm) return null;

  const match = BIBLE_BOOKS.find(
    b =>
      b.nameEnglish.toLowerCase() === norm ||
      b.id === norm.replace(/ /g, '-') ||
      b.abbreviation.toLowerCase() === norm ||
      b.id === ALIASES[norm]
  );
  if (!match) return null;

  if (chapter < 1 || chapter > match.totalChapters) return null;

  const validVerse = typeof verse === 'number' && Number.isInteger(verse) && verse >= 1 ? verse : undefined;
  return {
    bookId: match.id,
    chapter,
    verse: validVerse,
    label: `${match.nameEnglish} ${chapter}${validVerse ? `:${validVerse}` : ''}`,
  };
}
