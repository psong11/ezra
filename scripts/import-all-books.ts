import fs from 'fs';
import path from 'path';
import https from 'https';

/**
 * Complete Bible Import Script
 * Imports word-by-word translations for all 66 books from STEPBible data
 */

interface WordTranslation {
  word: string;
  translation: string;
  transliteration?: string;
}

interface BibleVerse {
  verse: number;
  text: string;
  words?: string[];
  wordTranslations?: WordTranslation[];
}

interface BibleChapter {
  chapter: number;
  verses: BibleVerse[];
}

interface BibleBook {
  book: any;
  chapters: BibleChapter[];
}

// Map STEPBible book codes to our book IDs
const HEBREW_BOOK_MAP: Record<string, string> = {
  'Gen': 'genesis',
  'Exo': 'exodus',
  'Lev': 'leviticus',
  'Num': 'numbers',
  'Deu': 'deuteronomy',
  'Jos': 'joshua',
  'Jdg': 'judges',
  'Rut': 'ruth',
  '1Sa': '1-samuel',
  '2Sa': '2-samuel',
  '1Ki': '1-kings',
  '2Ki': '2-kings',
  '1Ch': '1-chronicles',
  '2Ch': '2-chronicles',
  'Ezr': 'ezra',
  'Neh': 'nehemiah',
  'Est': 'esther',
  'Job': 'job',
  'Psa': 'psalms',
  'Pro': 'proverbs',
  'Ecc': 'ecclesiastes',
  'Sng': 'song-of-songs',
  'Isa': 'isaiah',
  'Jer': 'jeremiah',
  'Lam': 'lamentations',
  'Ezk': 'ezekiel',
  'Dan': 'daniel',
  'Hos': 'hosea',
  'Jol': 'joel',
  'Amo': 'amos',
  'Oba': 'obadiah',
  'Jon': 'jonah',
  'Mic': 'micah',
  'Nah': 'nahum',
  'Nam': 'nahum',
  'Hab': 'habakkuk',
  'Zep': 'zephaniah',
  'Hag': 'haggai',
  'Zec': 'zechariah',
  'Mal': 'malachi'
};

const GREEK_BOOK_MAP: Record<string, string> = {
  'Mat': 'matthew',
  'Mrk': 'mark',
  'Luk': 'luke',
  'Jhn': 'john',
  'Act': 'acts',
  'Rom': 'romans',
  '1Co': '1-corinthians',
  '2Co': '2-corinthians',
  'Gal': 'galatians',
  'Eph': 'ephesians',
  'Php': 'philippians',
  'Col': 'colossians',
  '1Th': '1-thessalonians',
  '2Th': '2-thessalonians',
  '1Ti': '1-timothy',
  '2Ti': '2-timothy',
  'Tit': 'titus',
  'Phm': 'philemon',
  'Heb': 'hebrews',
  'Jas': 'james',
  '1Pe': '1-peter',
  '2Pe': '2-peter',
  '1Jn': '1-john',
  '2Jn': '2-john',
  '3Jn': '3-john',
  'Jud': 'jude',
  'Rev': 'revelation'
};

// STEPBible data file URLs
const HEBREW_FILES = [
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt'
];

const GREEK_FILES = [
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt',
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt'
];

/**
 * Download a file from URL
 */
function downloadFile(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Parse a single line of STEPBible data
 * Hebrew format: Ref | Hebrew | Transliteration | Translation | Strong's | ...
 * Greek format: Ref | Greek (transliteration) | Translation | Strong's | ...
 */
function parseLine(line: string, isGreek: boolean = false): { book: string; chapter: number; verse: number; word: string; translation: string; transliteration: string; } | null {
  const parts = line.split('\t');
  
  if (parts.length < 4) return null;
  
  const ref = parts[0];
  
  // Skip header lines
  if (!ref || ref.startsWith('#') || ref.startsWith('$') || ref.startsWith('Eng')) {
    return null;
  }
  
  // Parse reference: Gen.001.002#01 = Genesis chapter 1 verse 2 word 1
  const match = ref.match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  
  const book = match[1];
  const chapter = parseInt(match[2]);
  const verse = parseInt(match[3]);
  
  let originalWord: string;
  let transliteration: string;
  let translation: string;
  
  if (isGreek) {
    // Greek format: Column 1 has "Word (transliteration)", Column 2 has translation
    const wordAndTranslit = parts[1]; // e.g., "Βίβλος (Biblos)"
    translation = parts[2]; // e.g., "[The] book"
    
    // Extract word and transliteration from "Word (translit)" format
    const wordMatch = wordAndTranslit.match(/^([^\(]+)\s*\(([^\)]+)\)/);
    if (wordMatch) {
      originalWord = wordMatch[1].trim();
      transliteration = wordMatch[2].trim();
    } else {
      originalWord = wordAndTranslit.trim();
      transliteration = '';
    }
  } else {
    // Hebrew format: separate columns
    originalWord = parts[1];
    transliteration = parts[2];
    translation = parts[3];
  }
  
  // Clean translation
  const cleanTranslation = translation.replace(/\//g, '').trim();
  const finalTranslation = cleanTranslation
    .replace(/<[^>]*>/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();
  
  // Clean word (remove pointing/cantillation for Hebrew)
  const cleanWord = originalWord.split(/[\/\\]/)[0] || originalWord;
  
  return {
    book,
    chapter,
    verse,
    word: cleanWord,
    translation: finalTranslation || cleanTranslation,
    transliteration: transliteration.replace(/\//g, '')
  };
}

/**
 * Process a single file and return word data grouped by book
 */
async function processFile(url: string, fileNum: number, totalFiles: number, isGreek: boolean = false): Promise<Map<string, Map<string, WordTranslation[]>>> {
  console.log(`\n📥 Downloading file ${fileNum}/${totalFiles}...`);
  const content = await downloadFile(url);
  const lines = content.split('\n');
  console.log(`   Downloaded ${lines.length.toLocaleString()} lines`);
  
  // Map: bookCode -> "chapter:verse" -> WordTranslation[]
  const bookData = new Map<string, Map<string, WordTranslation[]>>();
  
  let parsedCount = 0;
  for (const line of lines) {
    const result = parseLine(line, isGreek);
    if (result) {
      parsedCount++;
      
      if (!bookData.has(result.book)) {
        bookData.set(result.book, new Map());
      }
      
      const verseMap = bookData.get(result.book)!;
      const key = `${result.chapter}:${result.verse}`;
      
      if (!verseMap.has(key)) {
        verseMap.set(key, []);
      }
      
      verseMap.get(key)!.push({
        word: result.word,
        translation: result.translation,
        transliteration: result.transliteration
      });
    }
  }
  
  console.log(`   Parsed ${parsedCount.toLocaleString()} words from ${bookData.size} books`);
  return bookData;
}

/**
 * Normalize a word for matching (remove punctuation, accents, etc.)
 */
function normalizeWord(word: string | any): string {
  // Handle edge cases where word might not be a string
  if (!word) return '';
  
  // If word is an object with _ property (from XML parsing), extract the text
  const wordText = typeof word === 'object' && word !== null && '_' in word ? word._ : word;
  
  // Ensure we have a string
  const str = String(wordText);
  
  return str
    // Remove common punctuation
    .replace(/[,\.\;\:\!\?\—\-\'\"\(\)\[\]]/g, '')
    // Normalize spaces
    .trim()
    // Lowercase for comparison
    .toLowerCase()
    // Remove Hebrew vowel points and cantillation (U+0591 to U+05C7)
    .replace(/[\u0591-\u05C7]/g, '')
    // Remove Greek diacritics (combining marks)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Find matching translation for a word from the STEPBible data
 */
function findMatchingTranslation(
  word: string, 
  stepBibleWords: WordTranslation[], 
  usedIndices: Set<number>
): WordTranslation | null {
  const normalizedWord = normalizeWord(word);
  
  // Try to find an unused match
  for (let i = 0; i < stepBibleWords.length; i++) {
    if (usedIndices.has(i)) continue;
    
    const stepWord = stepBibleWords[i];
    const normalizedStepWord = normalizeWord(stepWord.word);
    
    if (normalizedWord === normalizedStepWord) {
      usedIndices.add(i);
      return stepWord;
    }
  }
  
  return null;
}

/**
 * Update a book's JSON file with word translations
 * NEW: Aligns wordTranslations array to match the existing words array
 */
function updateBookFile(bookId: string, verseMap: Map<string, WordTranslation[]>, isHebrew: boolean): number {
  const folder = isHebrew ? 'hebrew' : 'greek';
  const bookPath = path.join(process.cwd(), 'src', 'data', 'bible', folder, `${bookId}.json`);
  
  if (!fs.existsSync(bookPath)) {
    console.log(`   ⚠️  File not found: ${bookId}.json`);
    return 0;
  }
  
  const bookData: BibleBook = JSON.parse(fs.readFileSync(bookPath, 'utf-8'));
  let wordsAdded = 0;
  let wordsMatched = 0;
  let wordsMissed = 0;
  
  for (const chapter of bookData.chapters) {
    for (const verse of chapter.verses) {
      const key = `${chapter.chapter}:${verse.verse}`;
      const stepBibleWords = verseMap.get(key);
      
      if (!stepBibleWords || stepBibleWords.length === 0) {
        continue;
      }
      
      // Get the actual words array (or split from text if not available)
      const actualWords = verse.words || verse.text.split(/\s+/);
      
      // Match each word in actualWords to a translation from stepBibleWords
      const alignedTranslations: WordTranslation[] = [];
      const usedIndices = new Set<number>();
      
      for (const word of actualWords) {
        // Handle word objects from XML parsing
        const wordText = typeof word === 'object' && word !== null && '_' in word ? (word as any)._ : word;
        const wordStr = String(wordText);
        
        const match = findMatchingTranslation(wordStr, stepBibleWords, usedIndices);
        
        if (match) {
          alignedTranslations.push(match);
          wordsMatched++;
        } else {
          // No match found - add empty translation to maintain alignment
          alignedTranslations.push({
            word: wordStr,
            translation: '',
            transliteration: ''
          });
          wordsMissed++;
        }
      }
      
      verse.wordTranslations = alignedTranslations;
      wordsAdded += alignedTranslations.length;
    }
  }
  
  if (wordsMissed > 0) {
    console.log(`      ⚠️  ${bookId}: ${wordsMissed} words without matches`);
  }
  
  fs.writeFileSync(bookPath, JSON.stringify(bookData, null, 2));
  return wordsAdded;
}

/**
 * Main import function
 */
async function importAllBooks() {
  console.log('🚀 Starting complete Bible word translation import from STEPBible\n');
  console.log('📖 This will process all 66 books (39 OT + 27 NT)\n');
  
  const startTime = Date.now();
  let totalWords = 0;
  let totalBooks = 0;
  
  // Process Hebrew Old Testament
  console.log('═══════════════════════════════════════════════════');
  console.log('📜 HEBREW OLD TESTAMENT (39 books)');
  console.log('═══════════════════════════════════════════════════');
  
  for (let i = 0; i < HEBREW_FILES.length; i++) {
    const bookData = await processFile(HEBREW_FILES[i], i + 1, HEBREW_FILES.length);
    
    console.log('\n   📝 Updating book files...');
    for (const [bookCode, verseMap] of bookData.entries()) {
      const bookId = HEBREW_BOOK_MAP[bookCode];
      if (bookId) {
        const words = updateBookFile(bookId, verseMap, true);
        if (words > 0) {
          console.log(`      ✅ ${bookId}: ${words.toLocaleString()} words`);
          totalWords += words;
          totalBooks++;
        }
      }
    }
  }
  
  // Process Greek New Testament
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📜 GREEK NEW TESTAMENT (27 books)');
  console.log('═══════════════════════════════════════════════════');
  
  for (let i = 0; i < GREEK_FILES.length; i++) {
    const bookData = await processFile(GREEK_FILES[i], i + 1, GREEK_FILES.length, true); // Pass isGreek=true
    
    console.log('\n   📝 Updating book files...');
    for (const [bookCode, verseMap] of bookData.entries()) {
      const bookId = GREEK_BOOK_MAP[bookCode];
      if (bookId) {
        const words = updateBookFile(bookId, verseMap, false);
        if (words > 0) {
          console.log(`      ✅ ${bookId}: ${words.toLocaleString()} words`);
          totalWords += words;
          totalBooks++;
        }
      }
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🎉 IMPORT COMPLETE!');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Updated ${totalBooks} books`);
  console.log(`✅ Added ${totalWords.toLocaleString()} word translations`);
  console.log(`⏱️  Completed in ${elapsed} seconds`);
  console.log(`💰 Cost: $0 (free STEPBible data)`);
  console.log('═══════════════════════════════════════════════════\n');
}

// Run the import
importAllBooks().catch(console.error);
