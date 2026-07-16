/**
 * Bible Book Detail Page
 * Chapter selector for one book, styled to match the chapter reader.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BIBLE_BOOKS } from '@/data/bibleBooks';

interface Props {
  params: {
    bookId: string;
  };
}

export default function BookDetailPage({ params }: Props) {
  const book = BIBLE_BOOKS.find(b => b.id === params.bookId);

  if (!book) {
    notFound();
  }

  const isHebrew = book.testament === 'tanakh';
  const scriptFont = isHebrew ? 'font-hebrew' : 'font-serif';
  const chapters = Array.from({ length: book.totalChapters }, (_, i) => i + 1);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        {/* Breadcrumb */}
        <nav className="mb-10 flex items-center gap-2 text-sm text-stone-400">
          <Link href="/bible" className="transition-colors hover:text-amber-700">
            Books
          </Link>
          <span>›</span>
          <span className="text-stone-600">{book.nameEnglish}</span>
        </nav>

        {/* Book header */}
        <header className="mb-12 text-center">
          <h1 className="font-serif text-5xl tracking-tight text-stone-900">{book.nameEnglish}</h1>
          <p
            dir={isHebrew ? 'rtl' : 'ltr'}
            lang={isHebrew ? 'he' : 'el'}
            className={`${scriptFont} mt-3 text-2xl text-stone-400`}
          >
            {book.name}
          </p>
        </header>

        {/* Chapter grid */}
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
            Chapters
          </h2>
          <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">
            {book.totalChapters}
          </span>
          <div className="ml-2 h-px flex-1 self-center bg-stone-200/80" />
        </div>

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
          {chapters.map(chapterNum => (
            <Link
              key={chapterNum}
              href={`/bible/${book.id}/${chapterNum}`}
              className="flex aspect-square items-center justify-center rounded-lg border border-stone-200/80 bg-white/60 font-serif text-lg text-stone-700 transition-colors duration-200 hover:border-amber-300 hover:bg-amber-50/60 hover:text-amber-800"
            >
              {chapterNum}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Generate static params for all books
export function generateStaticParams() {
  return BIBLE_BOOKS.map((book) => ({
    bookId: book.id,
  }));
}
