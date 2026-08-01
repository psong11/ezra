/**
 * Word Study Panel
 * Renders a (possibly still-streaming) typed WordStudy: grammar rows,
 * meaning chips, and occurrence cards whose references link to their
 * chapters when they resolve to real books/chapters.
 * Pure content component — the parent decides where it lives
 * (desktop side column or mobile bottom sheet).
 */

import Link from 'next/link';
import { MorphemeSegment, Occurrence, PartialWordStudy } from '@/lib/explanation/schema';
import { formatSnippet } from '@/lib/explanation/format';
import { resolveReference } from '@/lib/explanation/refs';
import { AlignedSegment, alignSegmentsToWord } from '@/lib/explanation/morphemes';
import { tightenOccurrenceText } from '@/lib/explanation/occurrences';

const SEGMENT_STYLES: Record<MorphemeSegment['type'], string> = {
  root: 'bg-amber-100 text-amber-900 font-semibold',
  modifier: 'bg-violet-100 text-violet-900',
  affix: 'bg-sky-100 text-sky-900',
};

const SEGMENT_DOTS: Record<MorphemeSegment['type'], string> = {
  root: 'bg-amber-600',
  modifier: 'bg-violet-500',
  affix: 'bg-sky-500',
};

interface LegendEntry {
  key: string;
  type: MorphemeSegment['type'];
  label: string;
}

function buildLegend(
  morphemes: AlignedSegment[],
  stem: string | null | undefined
): LegendEntry[] {
  const entries: LegendEntry[] = [];
  const seenModifier = new Set<string>();
  const seenAffix = new Set<string>();

  for (const seg of morphemes) {
    if (!seg?.type) continue;
    if (seg.type === 'root' && !entries.some(e => e.type === 'root')) {
      entries.push({ key: 'root', type: 'root', label: seg.gloss ? `root — ${seg.gloss}` : 'root' });
    } else if (seg.type === 'modifier') {
      const label = stem ?? seg.gloss ?? 'pattern';
      if (!seenModifier.has(label)) {
        seenModifier.add(label);
        entries.push({ key: `modifier-${label}`, type: 'modifier', label: label.toLowerCase() });
      }
    } else if (seg.type === 'affix' && seg.gloss && !seenAffix.has(seg.gloss)) {
      seenAffix.add(seg.gloss);
      entries.push({ key: `affix-${seg.gloss}`, type: 'affix', label: seg.gloss });
    }
  }

  return entries;
}

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
  // Align against the clicked word (the reader's own text), never the
  // model's echo of it — display is sliced from the real surface form.
  const aligned = alignSegmentsToWord(word, study?.morphemes);
  const legend = aligned ? buildLegend(aligned, grammar?.stem) : [];
  const bridge = study?.meaningBridge;

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
            {aligned
              ? aligned.map((seg, i) => (
                  <span
                    key={i}
                    title={seg.gloss}
                    className={`rounded px-0.5 ${seg.type ? SEGMENT_STYLES[seg.type] : ''}`}
                  >
                    {seg.text}
                  </span>
                ))
              : word}
          </p>
          {study?.transliteration && (
            <p className="mt-0.5 text-sm italic text-stone-400">{study.transliteration}</p>
          )}
          {legend.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {legend.map(entry => (
                <span key={entry.key} className="flex items-center gap-1.5 text-xs text-stone-500">
                  <span className={`h-2 w-2 rounded-sm ${SEGMENT_DOTS[entry.type]}`} />
                  {entry.label}
                </span>
              ))}
            </div>
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
            {bridge && (bridge.combinedMeaning || bridge.note) && (
              <div className="mb-6 rounded-lg bg-amber-50 p-3.5">
                {(bridge.rootSense || bridge.patternNuance || bridge.combinedMeaning) && (
                  <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-amber-900">
                    {bridge.rootSense && <span>&quot;{bridge.rootSense}&quot;</span>}
                    {bridge.patternNuance && (
                      <>
                        <span aria-hidden className="text-amber-500">+</span>
                        <span>{bridge.patternNuance}</span>
                      </>
                    )}
                    {bridge.combinedMeaning && (
                      <>
                        <span aria-hidden className="text-amber-500">→</span>
                        <span className="font-semibold">&quot;{bridge.combinedMeaning}&quot;</span>
                      </>
                    )}
                  </p>
                )}
                {bridge.note && (
                  <p className="text-sm italic leading-relaxed text-amber-800/80">{bridge.note}</p>
                )}
              </div>
            )}

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
                  {grammar.stem && <GrammarRow label="Stem">{grammar.stem}</GrammarRow>}
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
                    const snippet = occ.snippet
                      ? tightenOccurrenceText(occ.snippet, {
                          word: study?.word ?? word,
                          root: grammar?.root,
                        })
                      : undefined;
                    // A long quote with no locatable target is an unverified
                    // citation mid-stream — don't dump a wall of text; the
                    // cached copy drops such occurrences entirely.
                    const showSnippet =
                      snippet !== undefined &&
                      (snippet.includes('**') || snippet.split(/\s+/).length <= 10);
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
                        {showSnippet && (
                          <p
                            dir={isHebrew ? 'rtl' : 'ltr'}
                            lang={isHebrew ? 'he' : 'el'}
                            className={`${scriptFont} mt-2 text-xl leading-relaxed text-stone-800 [&_strong]:font-bold [&_strong]:text-amber-800`}
                            dangerouslySetInnerHTML={{ __html: formatSnippet(snippet) }}
                          />
                        )}
                        {occ.translation && (
                          <p
                            className="mt-1.5 font-serif text-sm italic leading-relaxed text-stone-500 [&_strong]:font-semibold [&_strong]:text-amber-800"
                            dangerouslySetInnerHTML={{
                              __html: formatSnippet(
                                tightenOccurrenceText(occ.translation, { before: 6, after: 6 })
                              ),
                            }}
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
