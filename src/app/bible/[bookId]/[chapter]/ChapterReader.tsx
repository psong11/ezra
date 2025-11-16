'use client';

/**
 * Chapter Reader Component
 * Client-side component for displaying verses and providing TTS functionality
 */

import { useState, useRef, useEffect } from 'react';
import { BibleBookData, BibleChapter } from '@/types/bible';
import { prepareHebrewForTTS } from '@/lib/hebrewText';
import WordExplanationSidebar from '@/components/bible/WordExplanationSidebar';

interface Props {
  bookData: BibleBookData;
  bookName: string;
  hebrewName: string;
  chapterNum: number;
  chapterData: BibleChapter;
  isHebrew: boolean;
}

export default function ChapterReader({
  bookData,
  bookName,
  hebrewName,
  chapterNum,
  chapterData,
  isHebrew,
}: Props) {
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
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [hoveredWord, setHoveredWord] = useState<{ verse: number; wordIndex: number } | null>(null);
  const [hoverAudioEnabled, setHoverAudioEnabled] = useState(false);
  const wordAudioCache = useRef<Map<string, AudioBuffer>>(new Map());

  // Initialize AudioContext on first user interaction
  useEffect(() => {
    if (hoverAudioEnabled && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🔊 Audio context initialized for hover playback');
    }
  }, [hoverAudioEnabled]);

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

  // Get full chapter text for TTS (with cantillation marks removed)
  const getChapterText = () => {
    const fullText = chapterData.verses.map(v => v.text).join(' ');
    return prepareHebrewForTTS(fullText);
  };

  // Get full chapter text as SSML with pauses between verses
  // Chunks SSML if needed to stay under 5000 byte limit
  const getChapterSSMLChunks = () => {
    const MAX_SSML_BYTES = 4500; // Leave buffer for SSML tags
    const chunks: string[] = [];
    let currentVerses: string[] = [];
    let currentBytes = 30; // Account for <speak></speak> tags
    
    for (const verse of chapterData.verses) {
      const cleanedText = prepareHebrewForTTS(verse.text);
      // Account for text + break tag (approximately 22 bytes)
      const verseBytes = Buffer.byteLength(cleanedText, 'utf8') + 22;
      
      if (currentBytes + verseBytes > MAX_SSML_BYTES && currentVerses.length > 0) {
        // Start new chunk
        const ssml = `<speak>${currentVerses.join('<break time="1s"/>')}</speak>`;
        chunks.push(ssml);
        currentVerses = [cleanedText];
        currentBytes = 30 + Buffer.byteLength(cleanedText, 'utf8');
      } else {
        currentVerses.push(cleanedText);
        currentBytes += verseBytes;
      }
    }
    
    // Add final chunk
    if (currentVerses.length > 0) {
      const ssml = `<speak>${currentVerses.join('<break time="1s"/>')}</speak>`;
      chunks.push(ssml);
    }
    
    return chunks;
  };

  // Generate speech for entire chapter
  const handleGenerateSpeech = async () => {
    // Stop current audio and clear URL
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioUrl(null);
    
    setIsGenerating(true);
    setError(null);
    setShouldAutoPlay(true);

    try {
      const ssmlChunks = getChapterSSMLChunks();
      
      // If multiple chunks, fetch and concatenate
      if (ssmlChunks.length > 1) {
        console.log(`Fetching ${ssmlChunks.length} SSML chunks...`);
        const audioBuffers: ArrayBuffer[] = [];
        
        for (let i = 0; i < ssmlChunks.length; i++) {
          const response = await fetch('/api/tts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ssml: ssmlChunks[i],
              languageCode: 'he-IL',
              voiceName: 'he-IL-Wavenet-A',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate speech');
          }

          const buffer = await response.arrayBuffer();
          audioBuffers.push(buffer);
        }
        
        // Concatenate all audio buffers
        const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const buffer of audioBuffers) {
          combined.set(new Uint8Array(buffer), offset);
          offset += buffer.byteLength;
        }
        
        const audioBlob = new Blob([combined], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      } else {
        // Single chunk
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ssml: ssmlChunks[0],
            languageCode: 'he-IL',
            voiceName: 'he-IL-Wavenet-A',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate speech');
        }

        const audioBlob = await response.blob();
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      }
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
    // Stop current audio and clear URL
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

      // Remove cantillation marks for better TTS quality
      const cleanedText = prepareHebrewForTTS(verse.text);

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanedText,
          languageCode: 'he-IL',
          voiceName: 'he-IL-Wavenet-A',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err: any) {
      setError(err.message || 'Failed to generate speech');
      console.error('TTS Error:', err);
      setShouldAutoPlay(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // Update playback rate when changed
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // Speak a single word on hover using AudioContext for instant playback
  const speakWord = async (word: string) => {
    if (!hoverAudioEnabled || !audioContextRef.current) {
      return;
    }

    try {
      const cleanedWord = prepareHebrewForTTS(word);
      const cacheKey = `${isHebrew ? 'he' : 'el'}-${cleanedWord}`;

      // Check cache first
      let audioBuffer = wordAudioCache.current.get(cacheKey);

      if (!audioBuffer) {
        // Fetch audio from API
        const languageCode = isHebrew ? 'he-IL' : 'el-GR';
        const voiceName = isHebrew ? 'he-IL-Wavenet-A' : 'el-GR-Wavenet-A';

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: cleanedWord,
            languageCode,
            voiceName,
          }),
        });

        if (!response.ok) {
          console.error('Failed to generate word TTS');
          return;
        }

        const audioBlob = await response.arrayBuffer();
        audioBuffer = await audioContextRef.current.decodeAudioData(audioBlob);
        
        // Cache the decoded audio buffer
        wordAudioCache.current.set(cacheKey, audioBuffer);
      }

      // Stop any currently playing word audio
      if (wordAudioRef.current) {
        try {
          (wordAudioRef.current as any).stop();
        } catch (e) {
          // Ignore if already stopped
        }
      }

      // Play audio immediately using AudioContext
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      
      wordAudioRef.current = source as any;

    } catch (err) {
      console.error('Error speaking word:', err);
    }
  };

  // Enable hover audio (gets user permission)
  const enableHoverAudio = () => {
    setHoverAudioEnabled(true);
  };

  // Fetch word explanation from OpenAI API
  const fetchWordExplanation = async (word: string, verseNum: number, verseText: string) => {
    setIsLoadingExplanation(true);
    setExplanationError(null);
    setWordExplanation(null);

    try {
      const response = await fetch('/api/word-explanation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word,
          language: isHebrew ? 'Hebrew' : 'Greek',
          verse: verseText,
          bookName: bookName,
          chapterNum: chapterNum,
          verseNum: verseNum,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get explanation');
      }

      const data = await response.json();
      setWordExplanation(data.explanation);
      
      if (data.cached) {
        console.log('📦 Loaded from cache');
      } else {
        console.log('🤖 Fresh explanation from OpenAI');
      }
    } catch (err: any) {
      setExplanationError(err.message || 'Failed to load explanation');
      console.error('Word explanation error:', err);
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  return (
    <>
      {/* Word Explanation Sidebar - Only shown when a word is clicked */}
      {clickedWord && (
        <WordExplanationSidebar
          word={clickedWord.word}
          explanation={wordExplanation}
          isLoading={isLoadingExplanation}
          error={explanationError}
          onClose={() => {
            setClickedWord(null);
            setWordExplanation(null);
            setExplanationError(null);
          }}
        />
      )}

      <div className="space-y-6">
        {/* Listen to Full Chapter Button */}
        <div className="space-y-4">
        {/* Engaging subheader to encourage word interaction */}
        <p className="text-center text-gray-600 text-sm mb-2">
          ✨ Click on any word to discover its meaning and explore the ancient text
        </p>
        <button
          onClick={handleGenerateSpeech}
          disabled={isGenerating}
          className="w-full px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold shadow-lg"
        >
          {isGenerating ? '🔄 Generating...' : '🔊 Listen to Full Chapter'}
        </button>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {audioUrl && (
          <div className="space-y-2">
            <audio
              ref={audioRef}
              controls
              className="w-full"
              onEnded={() => setAudioUrl(null)}
            >
              <source src={audioUrl} type="audio/mpeg" />
            </audio>
            <p className="text-sm text-gray-500 text-center">
              Click on individual verses to hear them separately
            </p>
          </div>
        )}
      </div>

      {/* Chapter Text - Verse by Verse */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="space-y-4">
          {chapterData.verses.map((verse) => (
            <div
              key={verse.verse}
              className={`group relative p-4 rounded-lg transition-all ${
                selectedVerse === verse.verse
                  ? 'bg-amber-50 border-2 border-amber-300'
                  : 'hover:bg-gray-50 border-2 border-transparent'
              }`}
            >
              {/* Audio Button - Always visible on mobile, hover-reveal on desktop */}
              <button
                onClick={() => handleGenerateVerseSpeech(verse.verse)}
                disabled={isGenerating}
                className="absolute top-4 right-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 w-8 h-8 flex items-center justify-center bg-amber-600 text-white rounded-full hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
                title="Play this verse"
                aria-label={`Play verse ${verse.verse}`}
              >
                {selectedVerse === verse.verse && isGenerating ? (
                  <span className="text-xs">⏳</span>
                ) : (
                  <span className="text-xs">▶</span>
                )}
              </button>

              {/* Verse Text with superscript number */}
              <div className="flex-1">
                <div
                  dir={isHebrew ? "rtl" : "ltr"}
                  lang={isHebrew ? "he" : "el"}
                  className="text-3xl leading-relaxed text-gray-800 flex flex-wrap gap-x-2 gap-y-1"
                >
                  {/* Verse number as superscript */}
                  <sup className={`text-lg text-amber-600 font-bold ${isHebrew ? 'ml-1' : 'mr-1'}`}>{verse.verse}</sup>
                  {(verse.words || verse.text.split(/\s+/)).map((word, wordIndex) => {
                    // Handle case where word might be an object with _ property (from XML parsing)
                    const wordText = typeof word === 'object' && word !== null && '_' in word ? (word as any)._ : word;
                    const isActive = clickedWord?.verse === verse.verse && clickedWord?.wordIndex === wordIndex;
                    const wordTranslation = verse.wordTranslations?.[wordIndex];
                    
                    return (
                      <span
                        key={wordIndex}
                        className={`relative inline-flex flex-col items-center cursor-pointer px-1 rounded transition-colors ${
                          isActive 
                            ? 'text-amber-700 bg-amber-100 ring-2 ring-amber-500' 
                            : 'hover:text-amber-600 hover:bg-amber-50'
                        }`}
                        onClick={() => {
                          // Toggle: if same word is clicked, close it; otherwise open new one
                          if (isActive) {
                            setClickedWord(null);
                            setWordExplanation(null);
                            setExplanationError(null);
                          } else {
                            setClickedWord({ verse: verse.verse, wordIndex, word: wordText });
                            fetchWordExplanation(wordText, verse.verse, verse.text);
                          }
                        }}
                      >
                        {/* Original Hebrew/Greek word */}
                        <span className="text-3xl">{wordText}</span>
                        
                        {/* English translation directly below (only if available and not empty) */}
                        {wordTranslation?.translation && (
                          <span className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                            {wordTranslation.translation}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* English Translation */}
                {verse.translation && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-base leading-relaxed text-gray-600 italic">
                      {verse.translation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chapter Stats */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-amber-600">
              {chapterData.verses.length}
            </div>
            <div className="text-sm text-gray-600">Verses</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-amber-600">
              {chapterData.verses.reduce((sum, v) => sum + (v.words?.length || 0), 0)}
            </div>
            <div className="text-sm text-gray-600">Words</div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
