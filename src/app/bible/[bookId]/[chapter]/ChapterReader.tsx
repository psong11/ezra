'use client';

/**
 * Chapter Reader Component
 * Owns the full reading layout: verses, TTS, and the word-explanation panel.
 * On desktop the panel is a real layout column, so opening it slides the
 * reading column aside instead of covering it. On mobile it is a bottom sheet.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BibleChapter } from '@/types/bible';
import { prepareHebrewForTTS } from '@/lib/hebrewText';
import { formatExplanation } from '@/lib/explanation/format';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [clickedWord, setClickedWord] = useState<{ verse: number; wordIndex: number; word: string } | null>(null);
  const [wordExplanation, setWordExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const explanationAbortRef = useRef<AbortController | null>(null);

  const prevChapter = chapterNum > 1 ? chapterNum - 1 : null;
  const nextChapter = chapterNum < totalChapters ? chapterNum + 1 : null;

  const closeWord = useCallback(() => {
    explanationAbortRef.current?.abort();
    setClickedWord(null);
    setWordExplanation(null);
    setExplanationError(null);
  }, []);

  // Abort any in-flight explanation request on unmount
  useEffect(() => {
    return () => explanationAbortRef.current?.abort();
  }, []);

  // Keyboard: Escape closes the panel, arrows move between chapters
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWord();
      } else if (e.key === 'ArrowLeft' && prevChapter) {
        router.push(`/bible/${bookId}/${prevChapter}`);
      } else if (e.key === 'ArrowRight' && nextChapter) {
        router.push(`/bible/${bookId}/${nextChapter}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeWord, router, bookId, prevChapter, nextChapter]);

  // Auto-play when audioUrl changes
  useEffect(() => {
    if (audioUrl && shouldAutoPlay && audioRef.current) {
      audioRef.current.load();
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(err => {
        console.error('Auto-play failed:', err);
      });
      setShouldAutoPlay(false);
    }
  }, [audioUrl, shouldAutoPlay, playbackRate]);

  // Revoke each object URL only after it has been replaced (or on unmount) —
  // keyed on audioUrl alone so it can't fire mid-playback
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Get full chapter text as SSML with pauses between verses,
  // chunked to stay under the 5000-byte TTS limit
  const getChapterSSMLChunks = () => {
    const MAX_SSML_BYTES = 4500; // Leave buffer for SSML tags
    const chunks: string[] = [];
    let currentVerses: string[] = [];
    let currentBytes = 30; // Account for <speak></speak> tags

    for (const verse of chapterData.verses) {
      const cleanedText = prepareHebrewForTTS(verse.text);
      const verseBytes = Buffer.byteLength(cleanedText, 'utf8') + 22;

      if (currentBytes + verseBytes > MAX_SSML_BYTES && currentVerses.length > 0) {
        chunks.push(`<speak>${currentVerses.join('<break time="1s"/>')}</speak>`);
        currentVerses = [cleanedText];
        currentBytes = 30 + Buffer.byteLength(cleanedText, 'utf8');
      } else {
        currentVerses.push(cleanedText);
        currentBytes += verseBytes;
      }
    }

    if (currentVerses.length > 0) {
      chunks.push(`<speak>${currentVerses.join('<break time="1s"/>')}</speak>`);
    }

    return chunks;
  };

  const languageCode = isHebrew ? 'he-IL' : 'el-GR';
  const voiceName = isHebrew ? 'he-IL-Wavenet-A' : 'el-GR-Wavenet-A';

  const fetchTTS = async (body: Record<string, string>): Promise<ArrayBuffer> => {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageCode, voiceName, ...body }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate speech');
    }
    return response.arrayBuffer();
  };

  // Generate speech for entire chapter (chunks fetched in parallel)
  const handleGenerateSpeech = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioUrl(null);
    setIsGenerating(true);
    setSelectedVerse(null);
    setError(null);
    setShouldAutoPlay(true);

    try {
      const ssmlChunks = getChapterSSMLChunks();
      const audioBuffers = await Promise.all(ssmlChunks.map(ssml => fetchTTS({ ssml })));

      const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const buffer of audioBuffers) {
        combined.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
      }

      const audioBlob = new Blob([combined], { type: 'audio/mpeg' });
      setAudioUrl(URL.createObjectURL(audioBlob));
    } catch (err: any) {
      setError(err.message || 'Failed to generate speech');
      console.error('TTS Error:', err);
      setShouldAutoPlay(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate speech for a single verse
  const handleGenerateVerseSpeech = async (verseNum: number) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioUrl(null);
    setIsGenerating(true);
    setError(null);
    setSelectedVerse(verseNum);
    setShouldAutoPlay(true);

    try {
      const verse = chapterData.verses.find(v => v.verse === verseNum);
      if (!verse) throw new Error('Verse not found');

      const buffer = await fetchTTS({ text: prepareHebrewForTTS(verse.text) });
      const audioBlob = new Blob([buffer], { type: 'audio/mpeg' });
      setAudioUrl(URL.createObjectURL(audioBlob));
    } catch (err: any) {
      setError(err.message || 'Failed to generate speech');
      console.error('TTS Error:', err);
      setShouldAutoPlay(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch word explanation as a text stream, rendering as tokens arrive.
  // A new selection aborts the in-flight request so responses can't interleave.
  const fetchWordExplanation = async (word: string, verseNum: number, verseText: string) => {
    explanationAbortRef.current?.abort();
    const abort = new AbortController();
    explanationAbortRef.current = abort;

    setIsLoadingExplanation(true);
    setExplanationError(null);
    setWordExplanation(null);

    try {
      const response = await fetch('/api/word-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          word,
          language: isHebrew ? 'Hebrew' : 'Greek',
          verse: verseText,
          bookName,
          chapterNum,
          verseNum,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get explanation');
      }
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (abort.signal.aborted) return;
        setIsLoadingExplanation(false);
        setWordExplanation(formatExplanation(accumulated));
      }
      accumulated += decoder.decode();
      if (!abort.signal.aborted && accumulated.trim()) {
        setWordExplanation(formatExplanation(accumulated));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // superseded by a newer selection
      setExplanationError(err.message || 'Failed to load explanation');
      console.error('Word explanation error:', err);
    } finally {
      if (explanationAbortRef.current === abort) {
        setIsLoadingExplanation(false);
      }
    }
  };

  const scriptFont = isHebrew ? 'font-hebrew' : 'font-serif';
  const panelOpen = clickedWord !== null;

  const panel = clickedWord && (
    <WordExplanationSidebar
      word={clickedWord.word}
      isHebrew={isHebrew}
      explanation={wordExplanation}
      isLoading={isLoadingExplanation}
      error={explanationError}
      onClose={closeWord}
    />
  );

  return (
    <div className="lg:flex">
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
            <button
              onClick={handleGenerateSpeech}
              disabled={isGenerating}
              className="inline-flex items-center gap-2.5 rounded-full border border-amber-300/80 bg-white px-5 py-2.5 text-sm font-medium text-amber-900 shadow-sm transition-all hover:border-amber-400 hover:bg-amber-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating && selectedVerse === null ? <Spinner /> : <SpeakerIcon />}
              {isGenerating && selectedVerse === null ? 'Preparing audio…' : 'Listen to this chapter'}
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

          {audioUrl && (
            <div className="mb-10">
              <audio
                ref={audioRef}
                controls
                className="w-full"
                onEnded={() => setAudioUrl(null)}
              >
                <source src={audioUrl} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {/* Verses */}
          <div className="space-y-2">
            {chapterData.verses.map((verse) => (
              <div
                key={verse.verse}
                className={`group relative rounded-xl p-4 transition-colors duration-300 sm:p-5 ${
                  selectedVerse === verse.verse ? 'bg-amber-100/60' : 'hover:bg-amber-50/70'
                }`}
              >
                {/* Per-verse audio button */}
                <button
                  onClick={() => handleGenerateVerseSpeech(verse.verse)}
                  disabled={isGenerating}
                  className={`absolute top-4 flex h-7 w-7 items-center justify-center rounded-full text-amber-700 transition-all hover:bg-amber-200/70 disabled:cursor-not-allowed disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100 ${
                    isHebrew ? 'right-3' : 'left-3'
                  } ${selectedVerse === verse.verse ? 'md:opacity-100' : ''}`}
                  title="Play this verse"
                  aria-label={`Play verse ${verse.verse}`}
                >
                  {selectedVerse === verse.verse && isGenerating ? <Spinner className="h-3.5 w-3.5" /> : <PlayIcon />}
                </button>

                {/* Verse text with interlinear glosses */}
                <div
                  dir={isHebrew ? 'rtl' : 'ltr'}
                  lang={isHebrew ? 'he' : 'el'}
                  className={`${scriptFont} flex flex-wrap items-start gap-x-1.5 gap-y-3 pt-1 text-3xl leading-relaxed text-stone-800 ${
                    isHebrew ? 'pr-8' : 'pl-8'
                  }`}
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
                            fetchWordExplanation(wordText, verse.verse, verse.text);
                          }
                        }}
                      >
                        <span>{wordText}</span>
                        {gloss && (
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
            ))}
          </div>

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
            {chapterData.verses.length} verses · {chapterData.verses.reduce((sum, v) => sum + (v.words?.length || 0), 0)} words
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
