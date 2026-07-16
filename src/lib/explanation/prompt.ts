/**
 * Word-explanation prompt construction. Output structure is enforced by
 * the schema (see schema.ts); the prompt focuses on scholarly content.
 */

export interface WordExplanationRequest {
  word: string;
  language: string;
  verse: string;
  bookName?: string;
  chapterNum?: number;
  verseNum?: number;
}

export const EXPLANATION_SYSTEM_PROMPT =
  'You are a modern, religiously unbiased biblical scholar specializing in linguistic analysis, grammar, and historical context. You provide precise, structured word studies with academic rigor. No fluff.';

export function generateWordExplanationPrompt(request: WordExplanationRequest): string {
  const { word, language, verse, bookName, chapterNum, verseNum } = request;

  const context =
    bookName && chapterNum && verseNum
      ? `${bookName} ${chapterNum}:${verseNum}`
      : 'the biblical text';

  return `Provide a linguistic word study of the ${language} word "${word}" as it appears in ${context} ("${verse}").

Requirements:
- Analyze exactly this word: "${word}".
- grammar: give the root in its original script with transliteration; include gender/number only when applicable, and case only for Greek.
- rootMeanings / wordMeanings: closest English translations, most common first.
- occurrences: cite this word's FIRST occurrence in the Bible, then up to 3 other appearances that show diverse nuances. Use full English book names with real chapter and verse numbers. Each snippet must be in the original ${language} script and actually contain the word; wrap the target word in **double asterisks** in both the snippet and its English translation.`;
}
