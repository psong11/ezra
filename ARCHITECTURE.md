# Architecture Guide

This document provides a technical overview of the Ezra Bible Reader codebase, covering the system architecture, key components, data flow, and design decisions.

## 📋 Table of Contents
- [System Overview](#system-overview)
- [Directory Structure](#directory-structure)
- [Data Layer](#data-layer)
- [API Layer](#api-layer)
- [Frontend Components](#frontend-components)
- [Text-to-Speech System](#text-to-speech-system)
- [Word Explanation System](#word-explanation-system)
- [Caching Strategy](#caching-strategy)
- [Key Design Decisions](#key-design-decisions)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Bible Page  │  │ TTS Controls│  │ Word Explanation Modal  │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │                │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Routes (Next.js)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ /api/tts    │  │ /api/voices │  │ /api/word-explanation   │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       External Services                          │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │   Google Cloud TTS      │  │        OpenAI GPT-4o        │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
ezra/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API routes
│   │   │   ├── tts/route.ts      # Text-to-speech endpoint
│   │   │   ├── voices/route.ts   # Available voices endpoint
│   │   │   └── word-explanation/ # AI word explanation
│   │   ├── bible/
│   │   │   └── [bookId]/
│   │   │       └── [chapter]/
│   │   │           ├── page.tsx         # Chapter page (SSR)
│   │   │           └── ChapterReader.tsx # Client component
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Home page
│   │
│   ├── components/
│   │   ├── TTSControls.tsx       # TTS player component
│   │   └── bible/                # Bible-specific components
│   │
│   ├── data/
│   │   └── bible/
│   │       ├── hebrew/           # Hebrew Bible JSON (39 books)
│   │       │   ├── genesis.json
│   │       │   ├── exodus.json
│   │       │   └── ...
│   │       └── greek/            # Greek NT JSON (27 books)
│   │           ├── matthew.json
│   │           ├── mark.json
│   │           └── ...
│   │
│   ├── lib/
│   │   ├── bibleLoader.ts        # Book/chapter loading utilities
│   │   ├── env.ts                # Environment variable handling
│   │   ├── hebrewText.ts         # Hebrew text utilities
│   │   ├── tts/
│   │   │   ├── google.ts         # Google TTS client wrapper
│   │   │   ├── client.ts         # Browser TTS client
│   │   │   ├── cache.ts          # TTS caching (LRU + disk)
│   │   │   ├── chunking.ts       # Text chunking for long content
│   │   │   └── hash.ts           # Cache key generation
│   │   └── openai/
│   │       └── wordExplanation.ts # Word explanation service
│   │
│   └── types/
│       └── bible.ts              # TypeScript interfaces
│
├── data/                         # Source XML files
│   ├── Genesis.xml
│   ├── Matthew.xml
│   └── ...
│
├── scripts/                      # Build/utility scripts
│   ├── integrate-books.ts        # Automated book integration
│   ├── book-config.ts            # Book configuration
│   ├── add-translations.ts       # Add English glosses
│   └── ...
│
└── public/                       # Static assets
```

---

## Data Layer

### Bible Data Structure

Each book is stored as a JSON file with this structure:

```typescript
// src/types/bible.ts
interface BibleBookData {
  book: string;           // e.g., "Genesis"
  bookId: string;         // e.g., "genesis"
  testament: 'hebrew' | 'greek';
  totalChapters: number;
  chapters: ChapterData[];
}

interface ChapterData {
  chapter: number;
  verses: VerseData[];
}

interface VerseData {
  verse: number;
  text: string;           // Full verse text
  words?: WordData[];     // Word-by-word breakdown
}

interface WordData {
  word: string;           // Original Hebrew/Greek
  transliteration?: string;
  gloss?: string;         // English translation
  lemma?: string;         // Dictionary form
  morph?: string;         // Grammatical info
}
```

### Bible Loader

```typescript
// src/lib/bibleLoader.ts

// Book path mapping (66 books)
const BOOK_PATHS: Record<string, { folder: 'hebrew' | 'greek'; file: string }> = {
  'genesis': { folder: 'hebrew', file: 'genesis.json' },
  'matthew': { folder: 'greek', file: 'matthew.json' },
  // ... all 66 books
};

// Load a full book
export async function loadBook(bookId: string): Promise<BibleBookData>

// Get a specific chapter from a loaded book
export function getChapter(book: BibleBookData, chapter: number): ChapterData

// Get verse text
export function getVerseText(book: BibleBookData, chapter: number, verse: number): string
```

### Data Loading Strategy

- **Runtime Loading**: JSON files are read at request time using Node.js `fs`
- **No Bundling**: Bible data (~88MB total) is NOT bundled into the JavaScript
- **Server-Side Only**: Data loading happens in server components or API routes
- **Per-Request**: Each page load reads only the needed book

---

## API Layer

### `/api/tts` - Text-to-Speech

**POST** - Synthesize text to speech

```typescript
// Request
{
  text?: string;          // Plain text (or use ssml)
  ssml?: string;          // SSML markup
  languageCode: string;   // e.g., "he-IL", "el-GR"
  voiceName?: string;     // e.g., "he-IL-Wavenet-A"
  audioEncoding?: string; // "MP3" | "OGG_OPUS" | "LINEAR16"
  speakingRate?: number;  // 0.25 - 4.0 (default: 1.0)
  pitch?: number;         // -20.0 - 20.0 (default: 0.0)
}

// Response: Audio binary (audio/mpeg)
// Headers: X-Cache-Hit, X-Cache-Key
```

**Features**:
- Zod validation with empty string handling
- Automatic SSML detection
- Voice-language compatibility checking
- LRU caching (memory in production, disk in development)
- Automatic retry with exponential backoff

### `/api/voices` - Available Voices

**GET** - List available TTS voices

```typescript
// Response
{
  voices: [
    {
      name: "he-IL-Wavenet-A",
      languageCodes: ["he-IL"],
      ssmlGender: "FEMALE",
      naturalSampleRateHertz: 24000
    },
    // ...
  ]
}
```

**Notes**:
- Filters out Journey voices (require unsupported model parameter)
- Caches voice list for 1 hour

### `/api/word-explanation` - AI Word Explanation

**POST** - Get detailed word explanation

```typescript
// Request
{
  word: string;           // Hebrew/Greek word
  verse: string;          // Full verse for context
  bookName: string;       // e.g., "Genesis"
  chapter: number;
  verseNumber: number;
}

// Response
{
  word: string;
  explanation: string;    // AI-generated explanation
  cached: boolean;
}
```

---

## Frontend Components

### Chapter Reader (`ChapterReader.tsx`)

The main client component for reading Bible chapters.

**Key State**:
```typescript
const [audioUrl, setAudioUrl] = useState<string | null>(null);
const [isGenerating, setIsGenerating] = useState(false);
const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
const [hoverAudioEnabled, setHoverAudioEnabled] = useState(false);
const [playbackRate, setPlaybackRate] = useState(1.0);
```

**Key Functions**:
- `handleGenerateSpeech()` - Generate TTS for full chapter
- `handleGenerateVerseSpeech(verseNum)` - Generate TTS for single verse
- `speakWord(word)` - Play word audio on hover (uses AudioContext)
- `getChapterSSMLChunks()` - Split long chapters for TTS

### TTS Controls (`TTSControls.tsx`)

Reusable audio player component with:
- Play/pause button
- Progress bar with seek
- Playback speed selector
- Volume control

---

## Text-to-Speech System

### Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Browser   │───▶│  /api/tts    │───▶│  GoogleTTSClient│
│ (fetch)     │    │  (route.ts)  │    │  (google.ts)    │
└─────────────┘    └──────┬───────┘    └────────┬────────┘
                          │                     │
                          ▼                     ▼
                   ┌──────────────┐    ┌─────────────────┐
                   │   TTSCache   │    │ Google Cloud    │
                   │  (cache.ts)  │    │ Text-to-Speech  │
                   └──────────────┘    └─────────────────┘
```

### Google TTS Client (`src/lib/tts/google.ts`)

```typescript
class GoogleTTSClient {
  // Synthesize speech with automatic chunking
  async synthesize(params: SynthesisParams): Promise<Buffer>
  
  // List available voices (with caching)
  async listVoices(): Promise<IVoice[]>
}

// Singleton instance
export function getGoogleTTSClient(): GoogleTTSClient
```

**Features**:
- Automatic retry with exponential backoff (3 retries, 1s base delay)
- Text chunking for content > 5000 bytes
- Journey voice detection and blocking
- Voice list caching (1 hour TTL)

### Text Chunking (`src/lib/tts/chunking.ts`)

Google TTS has a 5000 byte limit per request. The chunker:
1. Splits text at sentence boundaries (`. `, `! `, `? `)
2. Keeps chunks under 4500 bytes (safety margin)
3. Maintains SSML structure if present
4. Concatenates resulting audio buffers

---

## Word Explanation System

### Flow

```
User clicks word
       │
       ▼
┌─────────────────────┐
│ /api/word-explanation│
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐     Cache hit?     ┌──────────────┐
    │ Check Cache  │────────Yes────────▶│ Return cached│
    └──────┬───────┘                    └──────────────┘
           │ No
           ▼
    ┌──────────────┐
    │ OpenAI GPT   │
    │ 4o-mini      │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Cache result │
    └──────────────┘
```

### Prompt Structure

The AI receives:
- The Hebrew/Greek word
- The full verse for context
- Book name, chapter, and verse number

And returns a brief explanation (~50-100 words) covering:
- Meaning and translation
- Grammatical form
- Usage in this context

---

## Caching Strategy

### TTS Cache (`src/lib/tts/cache.ts`)

**Dual-mode caching**:

| Environment | Strategy |
|-------------|----------|
| Development | LRU memory (200 items) + disk (`public/tts-cache/`) |
| Production | LRU memory only (Vercel has read-only filesystem) |

**Cache Key Generation** (`hash.ts`):
```typescript
// Deterministic hash from all TTS parameters
generateCacheKey({
  text, voiceName, languageCode, audioEncoding,
  speakingRate, pitch, volumeGainDb, model
}) → "a1b2c3d4..."
```

### Word Audio Cache (Client-side)

The `ChapterReader` maintains an in-memory cache of decoded audio buffers for hover-to-speak:

```typescript
const wordAudioCache = useRef<Map<string, AudioBuffer>>(new Map());
```

---

## Key Design Decisions

### 1. Runtime Data Loading

**Decision**: Load Bible JSON at request time, not build time

**Why**:
- 88MB of JSON would bloat the JS bundle
- Each request only needs one book
- Enables future database migration without code changes

### 2. Server Components for Data

**Decision**: Use Next.js Server Components for Bible pages

**Why**:
- Data fetching happens on server
- No client-side loading states for initial data
- Better SEO (content in initial HTML)

### 3. Memory-Only Cache in Production

**Decision**: Don't persist TTS cache on Vercel

**Why**:
- Vercel has read-only filesystem in serverless functions
- LRU memory cache handles repeated requests
- Acceptable tradeoff for deployment simplicity

### 4. Hebrew Text Processing

**Decision**: Strip cantillation marks for TTS

**Why**:
- Cantillation marks (טעמי המקרא) confuse TTS
- `hebrewText.ts` contains `prepareHebrewForTTS()` function
- Display still shows full marks for reading

### 5. SSML for Chapter TTS

**Decision**: Wrap verses in SSML with breaks

**Why**:
- Provides natural pauses between verses
- Allows future enhancements (speed per verse, emphasis)
- Google TTS handles SSML well

```xml
<speak>
  בְּרֵאשִׁית בָּרָא אֱלֹהִים
  <break time="1s"/>
  וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ
  <break time="1s"/>
  ...
</speak>
```

### 6. Automated Book Integration

**Decision**: Script-based integration vs manual file editing

**Why**:
- 66 books would take hours manually
- Scripts ensure consistency
- Easy to add future books or fix issues

---

## Performance Considerations

### Server-Side
- Bible JSON loaded once per request (not per component)
- TTS responses cached to avoid repeated Google API calls
- Voice list cached for 1 hour

### Client-Side
- Word audio buffers cached in memory
- Audio URLs created with `URL.createObjectURL()` (cleaned up on unmount)
- Playback uses Web Audio API for instant word playback

### Bundle Size
- Bible data NOT bundled (loaded at runtime)
- Only essential client JavaScript shipped
- Tailwind CSS purges unused styles

---

## Future Improvements

Potential enhancements documented for reference:

1. **Database Migration**: Move from JSON files to PostgreSQL/SQLite
2. **Offline Support**: Service worker for offline reading
3. **Audio Downloads**: Allow users to download chapter audio
4. **Bookmark System**: Save reading position
5. **Cross-References**: Link related verses
6. **Search**: Full-text search across all books
