/**
 * Bible data loading utilities
 * Uses dynamic file reading to avoid bundling all 88MB of JSON data
 */

import { BibleBookData } from '@/types/bible';
import path from 'path';
import fs from 'fs';

// Map of book IDs to their file paths
const BOOK_PATHS: Record<string, { folder: 'hebrew' | 'greek'; file: string }> = {
  'genesis': { folder: 'hebrew', file: 'genesis.json' },
  'exodus': { folder: 'hebrew', file: 'exodus.json' },
  'leviticus': { folder: 'hebrew', file: 'leviticus.json' },
  'numbers': { folder: 'hebrew', file: 'numbers.json' },
  'deuteronomy': { folder: 'hebrew', file: 'deuteronomy.json' },
  'joshua': { folder: 'hebrew', file: 'joshua.json' },
  'judges': { folder: 'hebrew', file: 'judges.json' },
  'ruth': { folder: 'hebrew', file: 'ruth.json' },
  '1-samuel': { folder: 'hebrew', file: '1-samuel.json' },
  '2-samuel': { folder: 'hebrew', file: '2-samuel.json' },
  '1-kings': { folder: 'hebrew', file: '1-kings.json' },
  '2-kings': { folder: 'hebrew', file: '2-kings.json' },
  '1-chronicles': { folder: 'hebrew', file: '1-chronicles.json' },
  '2-chronicles': { folder: 'hebrew', file: '2-chronicles.json' },
  'ezra': { folder: 'hebrew', file: 'ezra.json' },
  'nehemiah': { folder: 'hebrew', file: 'nehemiah.json' },
  'esther': { folder: 'hebrew', file: 'esther.json' },
  'job': { folder: 'hebrew', file: 'job.json' },
  'psalms': { folder: 'hebrew', file: 'psalms.json' },
  'proverbs': { folder: 'hebrew', file: 'proverbs.json' },
  'ecclesiastes': { folder: 'hebrew', file: 'ecclesiastes.json' },
  'song-of-songs': { folder: 'hebrew', file: 'song-of-songs.json' },
  'isaiah': { folder: 'hebrew', file: 'isaiah.json' },
  'jeremiah': { folder: 'hebrew', file: 'jeremiah.json' },
  'lamentations': { folder: 'hebrew', file: 'lamentations.json' },
  'ezekiel': { folder: 'hebrew', file: 'ezekiel.json' },
  'daniel': { folder: 'hebrew', file: 'daniel.json' },
  'hosea': { folder: 'hebrew', file: 'hosea.json' },
  'joel': { folder: 'hebrew', file: 'joel.json' },
  'amos': { folder: 'hebrew', file: 'amos.json' },
  'obadiah': { folder: 'hebrew', file: 'obadiah.json' },
  'jonah': { folder: 'hebrew', file: 'jonah.json' },
  'micah': { folder: 'hebrew', file: 'micah.json' },
  'nahum': { folder: 'hebrew', file: 'nahum.json' },
  'habakkuk': { folder: 'hebrew', file: 'habakkuk.json' },
  'zephaniah': { folder: 'hebrew', file: 'zephaniah.json' },
  'haggai': { folder: 'hebrew', file: 'haggai.json' },
  'zechariah': { folder: 'hebrew', file: 'zechariah.json' },
  'malachi': { folder: 'hebrew', file: 'malachi.json' },
  'matthew': { folder: 'greek', file: 'matthew.json' },
  'mark': { folder: 'greek', file: 'mark.json' },
  'luke': { folder: 'greek', file: 'luke.json' },
  'john': { folder: 'greek', file: 'john.json' },
  'acts': { folder: 'greek', file: 'acts.json' },
  'romans': { folder: 'greek', file: 'romans.json' },
  '1-corinthians': { folder: 'greek', file: '1-corinthians.json' },
  '2-corinthians': { folder: 'greek', file: '2-corinthians.json' },
  'galatians': { folder: 'greek', file: 'galatians.json' },
  'ephesians': { folder: 'greek', file: 'ephesians.json' },
  'philippians': { folder: 'greek', file: 'philippians.json' },
  'colossians': { folder: 'greek', file: 'colossians.json' },
  '1-thessalonians': { folder: 'greek', file: '1-thessalonians.json' },
  '2-thessalonians': { folder: 'greek', file: '2-thessalonians.json' },
  '1-timothy': { folder: 'greek', file: '1-timothy.json' },
  '2-timothy': { folder: 'greek', file: '2-timothy.json' },
  'titus': { folder: 'greek', file: 'titus.json' },
  'philemon': { folder: 'greek', file: 'philemon.json' },
  'hebrews': { folder: 'greek', file: 'hebrews.json' },
  'james': { folder: 'greek', file: 'james.json' },
  '1-peter': { folder: 'greek', file: '1-peter.json' },
  '2-peter': { folder: 'greek', file: '2-peter.json' },
  '1-john': { folder: 'greek', file: '1-john.json' },
  '2-john': { folder: 'greek', file: '2-john.json' },
  '3-john': { folder: 'greek', file: '3-john.json' },
  'jude': { folder: 'greek', file: 'jude.json' },
  'revelation': { folder: 'greek', file: 'revelation.json' },
};

export async function loadBook(bookId: string): Promise<BibleBookData> {
  const bookPath = BOOK_PATHS[bookId];
  if (!bookPath) throw new Error(`Book not found: ${bookId}`);
  const filePath = path.join(process.cwd(), 'src', 'data', 'bible', bookPath.folder, bookPath.file);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
}

export function getChapter(book: BibleBookData, chapter: number) {
  const chapterData = book.chapters.find(c => c.chapter === chapter);
  if (!chapterData) throw new Error(`Chapter ${chapter} not found`);
  return chapterData;
}

export function getChapterText(book: BibleBookData, chapter: number): string {
  const chapterData = book.chapters.find(c => c.chapter === chapter);
  if (!chapterData) throw new Error(`Chapter ${chapter} not found`);
  return chapterData.verses.map(v => v.text).join(' ');
}

export function getVerseText(book: BibleBookData, chapter: number, verse: number): string {
  const chapterData = book.chapters.find(c => c.chapter === chapter);
  if (!chapterData) throw new Error(`Chapter ${chapter} not found`);
  const verseData = chapterData.verses.find(v => v.verse === verse);
  if (!verseData) throw new Error(`Verse ${chapter}:${verse} not found`);
  return verseData.text;
}

export function getChapterVerses(book: BibleBookData, chapter: number) {
  const chapterData = book.chapters.find(c => c.chapter === chapter);
  if (!chapterData) throw new Error(`Chapter ${chapter} not found`);
  return chapterData.verses;
}

/**
 * Which script a book is written in — drives TTS voice selection so a
 * caller only has to name the book, not know its language.
 */
export function getBookLanguage(bookId: string): 'hebrew' | 'greek' | null {
  return BOOK_PATHS[bookId]?.folder ?? null;
}
