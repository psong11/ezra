'use client';

/**
 * Chapter Reader Component
 * Owns the full reading layout: verses, TTS, and the word-explanation panel.
 * On desktop the panel is a real layout column, so opening it slides the
 * reading column aside instead of covering it. On mobile it is a bottom sheet.
 *
 * Audio is synthesized per verse and played sequentially through one hidden
 * <audio> element: playback starts after fetching only the first verse, the
 * next verse is prefetched while the current one plays, and the active verse
 * is highlighted and kept in view.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useObject } from '@ai-sdk/react';
import { BibleChapter } from '@/types/bible';
import { prepareHebrewForTTS } from '@/lib/hebrewText';
import { wordStudySchema, PartialWordStudy } from '@/lib/explanation/schema';
import WordExplanationSidebar from '@/components/bible/WordExplanationSidebar';

interface Props {
  bookId: string;
  bookName: string;
  hebrewName: string;
  chapterNum: number;
  totalChapters: number;
  chapterData: BibleChapter;
  isHebrew: boolean;
}

interface PlaybackState {
  mode: 'chapter' | 'single';
  verse: number;
  paused: boolean;
  fetching: boolean;
}

const PLAYBACK_RATES = [1, 1.25, 1.5];
const GLOSS_PREF_KEY = 'ezra:show-glosses';

/** Turn STEP-style gloss notation like "<.obj>" into a readable muted label. */
function cleanGloss(gloss: string | undefined): string | null {
  if (!gloss) return null;
  const notation = gloss.match(/^<\.?([^>]+)>$/);
  return notation ? notation[1] : gloss;
}

function SpeakerIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
    </svg>
  );
}

function PlayIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.86l10.9-6.86a1 1 0 0 0 0-1.72L9.52 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

function PauseIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function StopIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SkipIcon({ back = false, className = 'h-4 w-4' }: { back?: boolean; className?: string }) {
  return (
    <svg className={`${className} ${back ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5.14v13.72a1 1 0 0 0 1.52.86l10.13-6.86a1 1 0 0 0 0-1.72L6.52 4.28A1 1 0 0 0 5 5.14z" />
      <rect x="17.5" y="5" width="2.5" height="14" rx="1" />
    </svg>
  );
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z" />
    </svg>
  );
}

export default function ChapterReader({
  bookId,
  bookName,
  hebrewName,
  chapterNum,
  totalChapters,
  chapterData,
  isHebrew,
}: Props) {
  const router = useRouter();
  const verses = chapterData.verses;

  const [error, setError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [clickedWord, setClickedWord] = useState<{ verse: number; wordIndex: number; word: string } | null>(null);
  // Interlinear glosses: on by default, remembered for the browsing
  // session. Read after mount rather than during render — the server
  // has no sessionStorage, so seeding state from it directly would
  // desync hydration.
  const [showGlosses, setShowGlosses] = useState(true);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(GLOSS_PREF_KEY) === 'off') setShowGlosses(false);
    } catch {
      // private mode / storage disabled — glosses simply stay visible
    }
  }, []);

  const toggleGlosses = useCallback(() => {
    setShowGlosses(prev => {
      const next = !prev;
      try {
        window.sessionStorage.setItem(GLOSS_PREF_KEY, next ? 'on' : 'off');
      } catch {
        // ignore: the toggle still works for this page
      }
      return next;
    });
  }, []);
  // Verse targeted via #vN in the URL (occurrence links) — highlighted briefly.
  // CSS :target doesn't update on client-side navigations, so track it in state.
  const [anchorVerse, setAnchorVerse] = useState<number | null>(null);

  // Streams the typed word study; `object` fills in field-by-field as JSON arrives
  const {
    object: study,
    submit: submitStudy,
    isLoading: studyLoading,
    error: studyError,
    stop: stopStudy,
    clear: clearStudy,
  } = useObject({ api: '/api/word-explanation', schema: wordStudySchema });
  const stopStudyRef = useRef(stopStudy);

  const audioElRef = useRef<HTMLAudioElement>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(0); // bumping invalidates in-flight onended chains
  const playbackRef = useRef<PlaybackState | null>(null);
  const rateRef = useRef(1);
  const verseAudioUrls = useRef<Map<number, string>>(new Map());
  const verseFetches = useRef<Map<number, Promise<string>>>(new Map());
  const verseElements = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastUserScrollRef = useRef(0);

  // Mirror volatile state into refs so audio event handlers never go stale
  useEffect(() => {
    playbackRef.current = playback;
    rateRef.current = playbackRate;
  }, [playback, playbackRate]);
  useEffect(() => {
    stopStudyRef.current = stopStudy;
  }, [stopStudy]);

  const prevChapter = chapterNum > 1 ? chapterNum - 1 : null;
  const nextChapter = chapterNum < totalChapters ? chapterNum + 1 : null;

  const closeWord = useCallback(() => {
    stopStudyRef.current();
    setClickedWord(null);
  }, []);

  // Cancel any streaming study on unmount
  useEffect(() => {
    return () => stopStudyRef.current();
  }, []);

  // Highlight the #vN-anchored verse for a few seconds and scroll to it.
  // Occurrence links use scroll={false}, so this effect is the only scroll
  // owner: jump early, then verify after the panel-collapse animation and
  // hydration have settled, re-jumping only if the verse drifted. Keyed on
  // the chapter (not mount) because the App Router can reuse the component
  // instance across chapter navigations.
  useEffect(() => {
    const timers: number[] = [];
    const applyHash = () => {
      const m = window.location.hash.match(/^#v(\d+)$/);
      if (!m) return;
      const verseNum = parseInt(m[1]);
      setAnchorVerse(verseNum);
      const centerOffset = () => {
        const r = verseElements.current.get(verseNum)?.getBoundingClientRect();
        return r ? Math.abs(r.top + r.height / 2 - window.innerHeight / 2) : 0;
      };
      const jump = () => verseElements.current.get(verseNum)?.scrollIntoView({ block: 'center' });
      timers.push(window.setTimeout(jump, 150));
      [800, 1600].forEach(delay =>
        timers.push(window.setTimeout(() => { if (centerOffset() > 200) jump(); }, delay))
      );
      timers.push(window.setTimeout(() => setAnchorVerse(null), 6000));
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => {
      window.removeEventListener('hashchange', applyHash);
      timers.forEach(t => window.clearTimeout(t));
    };
  }, [bookId, chapterNum]);

  // ---------- Audio engine ----------

  const getVerseAudioUrl = useCallback(
    (verseNum: number): Promise<string> => {
      const cached = verseAudioUrls.current.get(verseNum);
      if (cached) return Promise.resolve(cached);

      let pending = verseFetches.current.get(verseNum);
      if (!pending) {
        pending = (async () => {
          const verse = verses.find(v => v.verse === verseNum);
          if (!verse) throw new Error(`Verse ${verseNum} not found`);
          if (!ttsAbortRef.current) ttsAbortRef.current = new AbortController();

          const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ttsAbortRef.current.signal,
            body: JSON.stringify({
              text: prepareHebrewForTTS(verse.text),
              languageCode: isHebrew ? 'he-IL' : 'el-GR',
              voiceName: isHebrew ? 'he-IL-Wavenet-A' : 'el-GR-Wavenet-A',
            }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to generate speech');
          }
          const buffer = await response.arrayBuffer();
          const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/mpeg' }));
          verseAudioUrls.current.set(verseNum, url);
          return url;
        })();
        verseFetches.current.set(verseNum, pending);
        // A failed fetch must not poison the map — allow retries
        pending.catch(() => verseFetches.current.delete(verseNum));
      }
      return pending;
    },
    [verses, isHebrew]
  );

  const stopPlayback = useCallback(() => {
    sessionRef.current += 1;
    const audio = audioElRef.current;
    if (audio) {
      audio.onended = null;
      audio.pause();
    }
    setPlayback(null);
  }, []);

  const playFromVerse = useCallback(
    async (verseNum: number, mode: 'chapter' | 'single') => {
      const session = ++sessionRef.current;
      setError(null);
      setPlayback({ mode, verse: verseNum, paused: false, fetching: true });

      try {
        const url = await getVerseAudioUrl(verseNum);
        if (session !== sessionRef.current) return; // superseded
        const audio = audioElRef.current;
        if (!audio) return;

        audio.onended = () => {
          if (session !== sessionRef.current) return;
          const idx = verses.findIndex(v => v.verse === verseNum);
          const next = verses[idx + 1];
          if (mode === 'chapter' && next) {
            playFromVerse(next.verse, 'chapter');
          } else {
            stopPlayback();
          }
        };
        audio.src = url;
        audio.playbackRate = rateRef.current;
        await audio.play();
        if (session !== sessionRef.current) return;
        setPlayback({ mode, verse: verseNum, paused: false, fetching: false });

        // Prefetch the next verse while this one plays
        if (mode === 'chapter') {
          const idx = verses.findIndex(v => v.verse === verseNum);
          const next = verses[idx + 1];
          if (next) getVerseAudioUrl(next.verse).catch(() => {});
        }
      } catch (err: any) {
        if (session !== sessionRef.current || err?.name === 'AbortError') return;
        console.error('TTS Error:', err);
        setError(err.message || 'Failed to generate speech');
        stopPlayback();
      }
    },
    [verses, getVerseAudioUrl, stopPlayback]
  );

  const togglePause = useCallback(() => {
    const audio = audioElRef.current;
    const current = playbackRef.current;
    if (!audio || !current || current.fetching) return;
    if (current.paused) {
      audio.play().catch(() => {});
      setPlayback({ ...current, paused: false });
    } else {
      audio.pause();
      setPlayback({ ...current, paused: true });
    }
  }, []);

  const skipVerse = useCallback(
    (delta: number) => {
      const current = playbackRef.current;
      if (!current) return;
      const idx = verses.findIndex(v => v.verse === current.verse);
      const target = verses[idx + delta];
      if (target) playFromVerse(target.verse, current.mode);
    },
    [verses, playFromVerse]
  );

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate(prev => {
      const next = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(prev) + 1) % PLAYBACK_RATES.length];
      if (audioElRef.current) audioElRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const handleVerseButton = (verseNum: number) => {
    const current = playbackRef.current;
    if (current?.verse === verseNum) {
      togglePause();
    } else if (current?.mode === 'chapter') {
      playFromVerse(verseNum, 'chapter'); // jump within chapter playback
    } else {
      playFromVerse(verseNum, 'single');
    }
  };

  // Keep the active verse in view during chapter playback, but never fight
  // the user's own scrolling (suppressed for 5s after a manual scroll).
  // Some environments silently drop smooth scrolling, so verify movement
  // and fall back to an instant jump.
  useEffect(() => {
    if (!playback || playback.mode !== 'chapter') return;
    if (Date.now() - lastUserScrollRef.current < 5000) return;
    const el = verseElements.current.get(playback.verse);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const target = Math.max(0, window.scrollY + rect.top - (window.innerHeight - rect.height) / 2);
    const startY = window.scrollY;
    if (Math.abs(target - startY) < 40) return; // already in view

    window.scrollTo({ top: target, behavior: 'smooth' });
    const fallback = window.setTimeout(() => {
      const userScrolledMeanwhile = Date.now() - lastUserScrollRef.current < 400;
      if (!userScrolledMeanwhile && Math.abs(window.scrollY - startY) < 5) {
        window.scrollTo({ top: target });
      }
    }, 400);
    return () => window.clearTimeout(fallback);
  }, [playback?.verse, playback?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const markScroll = () => { lastUserScrollRef.current = Date.now(); };
    window.addEventListener('wheel', markScroll, { passive: true });
    window.addEventListener('touchmove', markScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', markScroll);
      window.removeEventListener('touchmove', markScroll);
    };
  }, []);

  // Cleanup on unmount: kill playback, abort fetches, release object URLs
  useEffect(() => {
    const urls = verseAudioUrls.current;
    const audio = audioElRef.current;
    return () => {
      sessionRef.current += 1;
      audio?.pause();
      ttsAbortRef.current?.abort();
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // Keyboard: Escape closes the panel, arrows move between chapters,
  // space toggles pause during playback
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWord();
      } else if (e.key === ' ' && playbackRef.current) {
        e.preventDefault();
        togglePause();
      } else if (e.key === 'ArrowLeft' && prevChapter) {
        router.push(`/bible/${bookId}/${prevChapter}`);
      } else if (e.key === 'ArrowRight' && nextChapter) {
        router.push(`/bible/${bookId}/${nextChapter}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeWord, togglePause, router, bookId, prevChapter, nextChapter]);

  // ---------- Word explanations ----------

  // Kick off a streamed word study; stop any in-flight one first so
  // responses can't interleave.
  const openWordStudy = (word: string, verseNum: number, verseText: string) => {
    stopStudy();
    clearStudy();
    submitStudy({
      word,
      language: isHebrew ? 'Hebrew' : 'Greek',
      verse: verseText,
      bookName,
      chapterNum,
      verseNum,
    });
  };

  const scriptFont = isHebrew ? 'font-hebrew' : 'font-serif';
  const panelOpen = clickedWord !== null;
  const chapterMode = playback?.mode === 'chapter';
  const activeVerseIndex = playback ? verses.findIndex(v => v.verse === playback.verse) : -1;

  const panel = clickedWord && (
    <WordExplanationSidebar
      word={clickedWord.word}
      isHebrew={isHebrew}
      study={study as PartialWordStudy | undefined}
      isLoading={studyLoading}
      error={studyError ? studyError.message || 'Failed to load explanation' : null}
      onClose={closeWord}
    />
  );

  return (
    <div className="lg:flex">
      {/* Hidden element that plays every verse in turn */}
      <audio ref={audioElRef} className="hidden" />

      {/* Reading column — re-centers smoothly as the panel opens/closes */}
      <main className="min-w-0 flex-1 transition-all duration-500">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          {/* Breadcrumb */}
          <nav className="mb-10 flex items-center gap-2 text-sm text-stone-400">
            <Link href="/bible" className="transition-colors hover:text-amber-700">
              Books
            </Link>
            <span>/</span>
            <Link href={`/bible/${bookId}`} className="transition-colors hover:text-amber-700">
              {bookName}
            </Link>
            <span>/</span>
            <span className="text-stone-600">Chapter {chapterNum}</span>
          </nav>

          {/* Chapter header */}
          <header className="mb-8 text-center">
            <h1 className="font-serif text-5xl tracking-tight text-stone-900">
              {bookName} <span className="text-amber-700">{chapterNum}</span>
            </h1>
            <p dir="rtl" lang={isHebrew ? 'he' : 'el'} className={`${scriptFont} mt-3 text-2xl text-stone-400`}>
              {hebrewName} {chapterNum}
            </p>
          </header>

          {/* Listen controls */}
          <div className="mb-12 flex flex-col items-center gap-3">
            {!chapterMode && (
              <button
                onClick={() => verses.length > 0 && playFromVerse(verses[0].verse, 'chapter')}
                disabled={playback?.fetching}
                className="inline-flex items-center gap-2.5 rounded-full border border-amber-300/80 bg-white px-5 py-2.5 text-sm font-medium text-amber-900 shadow-sm transition-all hover:border-amber-400 hover:bg-amber-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SpeakerIcon />
                Listen to this chapter
              </button>
            )}
            <button
              onClick={toggleGlosses}
              role="switch"
              aria-checked={showGlosses}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-stone-500 transition-colors hover:bg-amber-50 hover:text-amber-800"
            >
              <span
                aria-hidden
                className={`relative h-4 w-7 flex-shrink-0 rounded-full transition-colors ${
                  showGlosses ? 'bg-amber-500/80' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${
                    showGlosses ? 'left-3.5' : 'left-0.5'
                  }`}
                />
              </span>
              English under each word
            </button>
            <p className="text-xs text-stone-400">
              Tap any word to explore its meaning · hover a verse to play it aloud
            </p>
          </div>

          {error && (
            <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Verses */}
          <div className="space-y-2">
            {verses.map((verse) => {
              const isPlayingVerse = playback?.verse === verse.verse;
              return (
              <div
                key={verse.verse}
                id={`v${verse.verse}`}
                ref={el => { if (el) verseElements.current.set(verse.verse, el); }}
                className={`group relative scroll-mt-24 rounded-xl p-4 transition-colors duration-700 sm:p-5 ${
                  isPlayingVerse || anchorVerse === verse.verse ? 'bg-amber-100/60' : 'hover:bg-amber-50/70'
                }`}
              >
                {/* Per-verse audio button */}
                <button
                  onClick={() => handleVerseButton(verse.verse)}
                  className={`absolute top-4 flex h-7 w-7 items-center justify-center rounded-full text-amber-700 transition-all hover:bg-amber-200/70 md:opacity-0 md:group-hover:opacity-100 ${
                    isHebrew ? 'right-3' : 'left-3'
                  } ${isPlayingVerse ? 'md:opacity-100' : ''}`}
                  title={isPlayingVerse ? (playback?.paused ? 'Resume' : 'Pause') : 'Play this verse'}
                  aria-label={`Play verse ${verse.verse}`}
                >
                  {isPlayingVerse && playback?.fetching ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : isPlayingVerse && !playback?.paused ? (
                    <PauseIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </button>

                {/* Verse text with interlinear glosses */}
                <div
                  dir={isHebrew ? 'rtl' : 'ltr'}
                  lang={isHebrew ? 'he' : 'el'}
                  className={`${scriptFont} flex flex-wrap items-start gap-x-1.5 pt-1 text-3xl leading-relaxed text-stone-800 ${
                    showGlosses ? 'gap-y-3' : 'gap-y-1'
                  } ${isHebrew ? 'pr-8' : 'pl-8'}`}
                >
                  <sup className={`font-serif text-sm font-semibold text-amber-600/90 ${isHebrew ? 'ml-1' : 'mr-1'}`}>
                    {verse.verse}
                  </sup>
                  {(verse.words || verse.text.split(/\s+/)).map((word, wordIndex) => {
                    const wordText = typeof word === 'object' && word !== null && '_' in word ? (word as any)._ : word;
                    const isActive = clickedWord?.verse === verse.verse && clickedWord?.wordIndex === wordIndex;
                    const gloss = cleanGloss(verse.wordTranslations?.[wordIndex]?.translation);

                    return (
                      <span
                        key={wordIndex}
                        className={`inline-flex cursor-pointer flex-col items-center rounded-md px-1.5 py-0.5 transition-colors duration-150 ${
                          isActive
                            ? 'bg-amber-200/80 text-amber-950'
                            : 'hover:bg-amber-100/80 hover:text-amber-900'
                        }`}
                        onClick={() => {
                          if (isActive) {
                            closeWord();
                          } else {
                            setClickedWord({ verse: verse.verse, wordIndex, word: wordText });
                            openWordStudy(wordText, verse.verse, verse.text);
                          }
                        }}
                      >
                        <span>{wordText}</span>
                        {showGlosses && gloss && (
                          <span dir="ltr" className="mt-1 whitespace-nowrap font-sans text-[11px] leading-tight text-stone-400">
                            {gloss}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* Full-verse English translation */}
                {verse.translation && (
                  <p className="mt-4 border-t border-stone-200/70 pt-3 font-serif text-base italic leading-relaxed text-stone-500">
                    {verse.translation}
                  </p>
                )}
              </div>
              );
            })}
          </div>

          {/* Floating playback controls during chapter listening */}
          {chapterMode && playback && (
            <div className="sticky bottom-5 z-30 mt-6 flex justify-center">
              <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
                <button
                  onClick={() => skipVerse(-1)}
                  disabled={activeVerseIndex <= 0}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-amber-50 hover:text-amber-800 disabled:opacity-30"
                  aria-label="Previous verse"
                >
                  <SkipIcon back />
                </button>
                <button
                  onClick={togglePause}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-600 text-white transition-colors hover:bg-amber-700"
                  aria-label={playback.paused ? 'Resume' : 'Pause'}
                >
                  {playback.fetching ? <Spinner /> : playback.paused ? <PlayIcon /> : <PauseIcon />}
                </button>
                <button
                  onClick={() => skipVerse(1)}
                  disabled={activeVerseIndex >= verses.length - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-amber-50 hover:text-amber-800 disabled:opacity-30"
                  aria-label="Next verse"
                >
                  <SkipIcon />
                </button>
                <span className="mx-2 min-w-[4.5rem] text-center text-xs tabular-nums text-stone-500">
                  verse {playback.verse} / {verses[verses.length - 1]?.verse}
                </span>
                <button
                  onClick={cyclePlaybackRate}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-amber-50 hover:text-amber-800"
                  aria-label="Playback speed"
                >
                  {playbackRate}×
                </button>
                <button
                  onClick={stopPlayback}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Stop"
                >
                  <StopIcon />
                </button>
              </div>
            </div>
          )}

          {/* Chapter navigation */}
          <nav className="mt-14 flex items-center justify-between border-t border-stone-200/80 pt-8 text-sm">
            {prevChapter ? (
              <Link
                href={`/bible/${bookId}/${prevChapter}`}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium text-stone-600 transition-colors hover:bg-amber-50 hover:text-amber-800"
              >
                <span aria-hidden>←</span> Chapter {prevChapter}
              </Link>
            ) : <span />}

            <Link
              href={`/bible/${bookId}`}
              className="rounded-full px-4 py-2 text-stone-400 transition-colors hover:bg-amber-50 hover:text-amber-800"
            >
              All chapters
            </Link>

            {nextChapter ? (
              <Link
                href={`/bible/${bookId}/${nextChapter}`}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium text-stone-600 transition-colors hover:bg-amber-50 hover:text-amber-800"
              >
                Chapter {nextChapter} <span aria-hidden>→</span>
              </Link>
            ) : <span />}
          </nav>

          <p className="mt-6 text-center text-xs text-stone-400">
            {verses.length} verses · {verses.reduce((sum, v) => sum + (v.words?.length || 0), 0)} words
          </p>
        </div>
      </main>

      {/* Desktop: the panel is a layout column — opening it slides the text aside.
          overflow-x-clip (not hidden) so the inner position:sticky keeps tracking the viewport */}
      <aside
        className={`hidden shrink-0 overflow-x-clip transition-all duration-500 lg:block ${
          panelOpen ? 'w-[26rem]' : 'w-0'
        }`}
        aria-hidden={!panelOpen}
      >
        <div className="sticky top-0 h-screen w-[26rem] overflow-y-auto border-l border-amber-200/60 bg-white/90 backdrop-blur">
          {panel}
        </div>
      </aside>

      {/* Mobile: bottom sheet with tap-to-dismiss backdrop */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-stone-900/20 lg:hidden"
            onClick={closeWord}
            aria-hidden
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] animate-slide-up overflow-y-auto rounded-t-3xl border-t border-amber-200 bg-white shadow-2xl lg:hidden">
            {panel}
          </div>
        </>
      )}
    </div>
  );
}
