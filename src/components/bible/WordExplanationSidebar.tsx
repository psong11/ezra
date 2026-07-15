/**
 * Word Explanation Panel
 * Pure content component — the parent decides where it lives
 * (desktop side column or mobile bottom sheet).
 */

interface WordExplanationSidebarProps {
  word: string;
  isHebrew: boolean;
  explanation: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export default function WordExplanationSidebar({
  word,
  isHebrew,
  explanation,
  isLoading,
  error,
  onClose,
}: WordExplanationSidebarProps) {
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
            className={`${isHebrew ? 'font-hebrew' : 'font-serif'} mt-1 truncate text-3xl text-stone-900`}
          >
            {word}
          </p>
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
        {isLoading && (
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

        {explanation && !isLoading && !error && (
          <div
            className="explanation"
            dir="ltr"
            dangerouslySetInnerHTML={{ __html: explanation }}
          />
        )}
      </div>
    </div>
  );
}
