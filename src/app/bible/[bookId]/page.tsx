/**
 * Bible Book Detail Page
 * Shows chapter selector for a specific book
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

  const chapters = Array.from({ length: book.totalChapters }, (_, i) => i + 1);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/bible"
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            ← Back to Books
          </Link>
        </div>

        {/* Book Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-2" dir="rtl">
            {book.name}
          </h1>
          <h2 className="text-3xl font-semibold text-gray-700 mb-4">
            {book.nameEnglish}
          </h2>
          <p className="text-gray-600">
            Select a chapter to read and listen
          </p>
        </div>

        {/* Chapter Grid */}
        <div className="max-w-5xl mx-auto">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">
            Chapters ({book.totalChapters})
          </h3>
          
          <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-20 gap-3">
            {chapters.map((chapterNum) => (
              <Link
                key={chapterNum}
                href={`/bible/${book.id}/${chapterNum}`}
                className="group"
              >
                <div className="aspect-square flex items-center justify-center bg-white rounded-lg shadow hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 border-2 border-transparent hover:border-amber-500">
                  <span className="text-lg font-bold text-gray-700 group-hover:text-amber-600 transition-colors">
                    {chapterNum}
                  </span>
                </div>
              </Link>
            ))}
          </div>
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
