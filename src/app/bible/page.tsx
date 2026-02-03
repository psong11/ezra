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
        <div className="text-center mb-10">
          <h1 className="text-6xl font-bold text-gray-900 mb-2 tracking-tight">
            Ezra
          </h1>
          <p className="text-sm text-gray-500 italic mb-6">
            /ˈskrīb/ — one who copies sacred texts by hand
          </p>
          
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mb-6"></div>
          
          <p className="text-lg text-gray-700 max-w-xl mx-auto leading-relaxed">
            Across millennia, humans have chosen to preserve a select few words—copied over and over by hand.
          </p>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            Here they are, read aloud with modern APIs, translated with LLMs.
          </p>
          <p className="text-amber-700 font-medium mt-4 text-lg">
            What will you preserve today?
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

        {/* Hebrew Scriptures (Tanakh) */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            תנ״ך <span className="text-gray-500 font-normal">— Hebrew Scriptures</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {BIBLE_BOOKS.filter(book => book.testament === 'tanakh').map((book) => (
              <Link
                key={book.id}
                href={`/bible/${book.id}`}
                className="group"
              >
                <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border-2 border-transparent hover:border-amber-500">
                  <div className="p-6">
                    <div className="text-right mb-3">
                      <h3 className="text-2xl font-bold text-gray-900" dir="rtl">
                        {book.name}
                      </h3>
                    </div>
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold text-gray-700">
                        {book.nameEnglish}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {book.abbreviation}
                      </span>
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
                        {book.totalChapters} chapters
                      </span>
                    </div>
                  </div>
                  <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Greek Scriptures (New Testament) */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            Καινὴ Διαθήκη <span className="text-gray-500 font-normal">— Greek Scriptures</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {BIBLE_BOOKS.filter(book => book.testament === 'new-testament').map((book) => (
              <Link
                key={book.id}
                href={`/bible/${book.id}`}
                className="group"
              >
                <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border-2 border-transparent hover:border-blue-500">
                  <div className="p-6">
                    <div className="text-left mb-3">
                      <h3 className="text-xl font-bold text-gray-900">
                        {book.name}
                      </h3>
                    </div>
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold text-gray-700">
                        {book.nameEnglish}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {book.abbreviation}
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
                        {book.totalChapters} chapters
                      </span>
                    </div>
                  </div>
                  <div className="h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                </div>
              </Link>
            ))}
          </div>
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
