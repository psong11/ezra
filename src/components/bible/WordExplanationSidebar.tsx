/**
 * Word Study Panel
 * Renders a (possibly still-streaming) typed WordStudy: grammar rows,
 * meaning chips, and occurrence cards whose references link to their
 * chapters when they resolve to real books/chapters.
 * Pure content component — the parent decides where it lives
 * (desktop side column or mobile bottom sheet).
 */

import Link from 'next/link';
import { Occurrence, PartialWordStudy } from '@/lib/explanation/schema';
import { formatSnippet } from '@/lib/explanation/format';
import { resolveReference } from '@/lib/explanation/refs';

interface WordExplanationSidebarProps {
  word: string;
  isHebrew: boolean;
  study: PartialWordStudy | undefined;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 first:mt-0">
      {children}
    </h4>
  );
}

function GrammarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1">
      <dt className="w-24 flex-shrink-0 text-[11px] uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="text-[15px] text-stone-700">{children}</dd>
    </div>
  );
}

function MeaningChips({ meanings }: { meanings: (string | undefined)[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {meanings.filter(Boolean).map((m, i) => (
        <span
          key={i}
          className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-sm text-amber-900"
        >
          {m}
        </span>
      ))}
    </div>
  );
}

export default function WordExplanationSidebar({
  word,
  isHebrew,
  study,
  isLoading,
  error,
  onClose,
}: WordExplanationSidebarProps) {
  const scriptFont = isHebrew ? 'font-hebrew' : 'font-serif';
  const showSkeleton = isLoading && !study;
  const grammar = study?.grammar;
  const occurrences = (study?.occurrences ?? []).filter(
    (o): o is Partial<Occurrence> => Boolean(o)
  );

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-amber-100 bg-white/95 px-6 pb-4 pt-5 backdrop-blur">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700/80">
            Word study
          </p>
          <p
            dir={isHebrew ? 'rtl' : 'ltr'}
            lang={isHebrew ? 'he' : 'el'}
            className={`${scriptFont} mt-1 truncate text-3xl text-stone-900`}
          >
            {word}
          </p>
          {study?.transliteration && (
            <p className="mt-0.5 text-sm italic text-stone-400">{study.transliteration}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-amber-50 hover:text-amber-800"
          aria-label="Close word explanation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-5">
        {showSkeleton && (
          <div className="animate-pulse space-y-6" aria-label="Loading explanation">
            {[0, 1, 2].map(section => (
              <div key={section} className="space-y-2.5">
                <div className="h-2.5 w-24 rounded bg-amber-200/70" />
                <div className="h-3 w-full rounded bg-stone-200/80" />
                <div className="h-3 w-5/6 rounded bg-stone-200/80" />
                <div className="h-3 w-2/3 rounded bg-stone-200/60" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="mb-1 text-sm font-semibold text-red-800">Something went wrong</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {study && !error && (
          <div>
            {grammar && (
              <>
                <SectionHeading>Grammar</SectionHeading>
                <dl>
                  {grammar.root && (
                    <GrammarRow label="Root">
                      <span dir={isHebrew ? 'rtl' : 'ltr'} lang={isHebrew ? 'he' : 'el'} className={`${scriptFont} text-lg`}>
                        {grammar.root}
                      </span>
                      {grammar.rootTransliteration && (
                        <span className="ml-2 italic text-stone-400">{grammar.rootTransliteration}</span>
                      )}
                    </GrammarRow>
                  )}
                  {grammar.partOfSpeech && <GrammarRow label="Part of speech">{grammar.partOfSpeech}</GrammarRow>}
                  {grammar.gender && <GrammarRow label="Gender">{grammar.gender}</GrammarRow>}
                  {grammar.number && <GrammarRow label="Number">{grammar.number}</GrammarRow>}
                  {grammar.grammaticalCase && <GrammarRow label="Case">{grammar.grammaticalCase}</GrammarRow>}
                </dl>
              </>
            )}

            {(study.rootMeanings?.length || study.wordMeanings?.length) ? (
              <>
                <SectionHeading>Meaning</SectionHeading>
                <div className="space-y-3">
                  {study.wordMeanings?.length ? (
                    <div>
                      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-stone-400">This form</p>
                      <MeaningChips meanings={study.wordMeanings} />
                    </div>
                  ) : null}
                  {study.rootMeanings?.length ? (
                    <div>
                      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-stone-400">Root</p>
                      <MeaningChips meanings={study.rootMeanings} />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {occurrences.length > 0 && (
              <>
                <SectionHeading>Occurrences</SectionHeading>
                <div className="space-y-3">
                  {occurrences.map((occ, i) => {
                    const resolved = resolveReference(occ.book, occ.chapter, occ.verse);
                    const label =
                      resolved?.label ??
                      (occ.book ? `${occ.book} ${occ.chapter ?? ''}${occ.verse ? `:${occ.verse}` : ''}` : '…');
                    return (
                      <div key={i} className="rounded-xl border border-stone-200/80 bg-white/60 p-3.5">
                        {resolved ? (
                          <Link
                            href={`/bible/${resolved.bookId}/${resolved.chapter}${resolved.verse ? `#v${resolved.verse}` : ''}`}
                            scroll={false}
                            className="text-xs font-semibold text-amber-700 hover:underline"
                          >
                            {label} <span aria-hidden>→</span>
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-stone-500">{label}</span>
                        )}
                        {occ.snippet && (
                          <p
                            dir={isHebrew ? 'rtl' : 'ltr'}
                            lang={isHebrew ? 'he' : 'el'}
                            className={`${scriptFont} mt-2 text-xl leading-relaxed text-stone-800 [&_strong]:font-bold [&_strong]:text-amber-800`}
                            dangerouslySetInnerHTML={{ __html: formatSnippet(occ.snippet) }}
                          />
                        )}
                        {occ.translation && (
                          <p
                            className="mt-1.5 font-serif text-sm italic leading-relaxed text-stone-500 [&_strong]:font-semibold [&_strong]:text-amber-800"
                            dangerouslySetInnerHTML={{ __html: formatSnippet(occ.translation) }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
