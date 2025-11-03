/**
 * Bible Books Grid Page
 * Displays all available Bible books as cards
 */

import Link from 'next/link';
import { BIBLE_BOOKS } from '@/data/bibleBooks';

export default function BibleBooksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            תנ״ך
          </h1>
          <h2 className="text-3xl font-semibold text-gray-700 mb-2">
            Hebrew Bible
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Listen to the ancient words of the Torah, Prophets, Writings, and New Testament in their original Hebrew and Greek,
            brought to life with modern text-to-speech technology.
          </p>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mb-12">
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600">{BIBLE_BOOKS.length}</div>
            <div className="text-sm text-gray-600">Books Available</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600">
              {BIBLE_BOOKS.reduce((sum, book) => sum + book.totalChapters, 0)}
            </div>
            <div className="text-sm text-gray-600">Chapters</div>
          </div>
        </div>

        {/* Books Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {BIBLE_BOOKS.map((book) => (
            <Link
              key={book.id}
              href={`/bible/${book.id}`}
              className="group"
            >
              <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border-2 border-transparent hover:border-amber-500">
                {/* Book Card */}
                <div className="p-6">
                  {/* Hebrew Name */}
                  <div className="text-right mb-3">
                    <h3 className="text-2xl font-bold text-gray-900" dir="rtl">
                      {book.name}
                    </h3>
                  </div>

                  {/* English Name */}
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-gray-700">
                      {book.nameEnglish}
                    </h4>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {book.abbreviation}
                    </span>
                    <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-medium">
                      {book.totalChapters} chapters
                    </span>
                  </div>
                </div>

                {/* Hover Effect Bar */}
                <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              </div>
            </Link>
          ))}
        </div>

        {/* Coming Soon Notice */}
        {BIBLE_BOOKS.length < 39 && (
          <div className="mt-12 text-center">
            <p className="text-gray-500 italic">
              More books coming soon...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
