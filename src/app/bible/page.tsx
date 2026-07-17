/**
 * Bible Books Grid Page
 * The library: every available book, grouped by testament,
 * in the same quiet parchment language as the chapter reader.
 */

import Link from 'next/link';
import { BIBLE_BOOKS } from '@/data/bibleBooks';
import type { BibleBook } from '@/types/bible';

function BookCard({ book }: { book: BibleBook }) {
  const isHebrew = book.testament === 'tanakh';
  const titleSize = isHebrew
    ? 'text-2xl'
    : book.name.length > 16
      ? 'text-base'
      : book.name.length > 10
        ? 'text-lg'
        : 'text-xl';
  return (
    <Link
      href={`/bible/${book.id}`}
      className="group flex flex-col rounded-xl border border-stone-200/80 bg-white/60 p-5 transition-colors duration-200 hover:border-amber-300 hover:bg-amber-50/60"
    >
      <p
        dir={isHebrew ? 'rtl' : 'ltr'}
        lang={isHebrew ? 'he' : 'el'}
        className={`${isHebrew ? 'font-hebrew' : 'font-serif'} ${titleSize} break-words leading-snug text-stone-900`}
      >
        {book.name}
      </p>
      <p className="mt-1 text-sm text-stone-500">{book.nameEnglish}</p>
      <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-stone-400 transition-colors group-hover:text-amber-700">
        {book.totalChapters} {book.totalChapters === 1 ? 'chapter' : 'chapters'}
      </p>
    </Link>
  );
}

function SectionHeader({
  script,
  scriptFont,
  label,
}: {
  script: string;
  scriptFont: string;
  label: string;
}) {
  return (
    <div className="mb-6 flex items-baseline gap-3">
      <h2 className={`${scriptFont} text-2xl text-stone-900`}>{script}</h2>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
        {label}
      </span>
      <div className="ml-2 h-px flex-1 self-center bg-stone-200/80" />
    </div>
  );
}

export default function BibleBooksPage() {
  const tanakh = BIBLE_BOOKS.filter(book => book.testament === 'tanakh');
  const newTestament = BIBLE_BOOKS.filter(book => book.testament !== 'tanakh');
  const totalChapters = BIBLE_BOOKS.reduce((sum, book) => sum + book.totalChapters, 0);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        {/* Hero */}
        <header className="mb-16 text-center">
          <h1 className="font-serif text-6xl tracking-tight text-stone-900 sm:text-7xl">Ezra</h1>

          <div className="mx-auto my-8 h-px w-16 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

          <p className="mx-auto max-w-xl font-serif text-xl leading-relaxed text-stone-700">
            Across millennia, humans have chosen to preserve a select few
            words—copied over and over by hand.
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-stone-400">
            Here they are in 2026, read aloud with modern APIs, translated with LLMs.
          </p>
          <p className="mt-6 font-serif text-lg italic text-amber-700">
            What will you preserve today?
          </p>

          {/* Stats */}
          <div className="mt-10 flex items-baseline justify-center gap-10">
            <div>
              <span className="font-serif text-3xl text-stone-900">{BIBLE_BOOKS.length}</span>
              <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-stone-400">
                books
              </span>
            </div>
            <div className="h-6 w-px self-center bg-stone-200" />
            <div>
              <span className="font-serif text-3xl text-stone-900">{totalChapters}</span>
              <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-stone-400">
                chapters
              </span>
            </div>
          </div>
        </header>

        {/* Hebrew Scriptures (Tanakh) */}
        <section className="mb-14">
          <SectionHeader script="תנ״ך" scriptFont="font-hebrew" label="Hebrew Scriptures" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {tanakh.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>

        {/* Greek Scriptures (New Testament) */}
        <section>
          <SectionHeader
            script="Καινὴ Διαθήκη"
            scriptFont="font-serif"
            label="Greek Scriptures"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {newTestament.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
