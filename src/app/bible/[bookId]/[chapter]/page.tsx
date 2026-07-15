/**
 * Bible Chapter Reader Page
 * Loads chapter data server-side and hands the full reading layout to ChapterReader.
 * Note: only chapterData crosses the server→client boundary — never the whole book.
 */

import { notFound } from 'next/navigation';
import { BIBLE_BOOKS } from '@/data/bibleBooks';
import { loadBook, getChapter } from '@/lib/bibleLoader';
import ChapterReader from './ChapterReader';

interface Props {
  params: {
    bookId: string;
    chapter: string;
  };
}

export default async function ChapterPage({ params }: Props) {
  const book = BIBLE_BOOKS.find(b => b.id === params.bookId);
  const chapterNum = parseInt(params.chapter);

  if (!book || isNaN(chapterNum) || chapterNum < 1 || chapterNum > book.totalChapters) {
    notFound();
  }

  const bookData = await loadBook(params.bookId);
  const chapterData = getChapter(bookData, chapterNum);

  return (
    <ChapterReader
      bookId={book.id}
      bookName={book.nameEnglish}
      hebrewName={book.name}
      chapterNum={chapterNum}
      totalChapters={book.totalChapters}
      chapterData={chapterData}
      isHebrew={book.testament === 'tanakh'}
    />
  );
}

// Generate static params for all chapters
export function generateStaticParams() {
  const params: { bookId: string; chapter: string }[] = [];

  for (const book of BIBLE_BOOKS) {
    for (let i = 1; i <= book.totalChapters; i++) {
      params.push({
        bookId: book.id,
        chapter: i.toString(),
      });
    }
  }

  return params;
}
