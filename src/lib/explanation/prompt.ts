/**
 * Word-explanation prompt construction.
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
  'You are a modern biblical scholar specializing in linguistic analysis, grammar, and historical context. You provide detailed, structured explanations of words with academic rigor.';

export function generateWordExplanationPrompt(request: WordExplanationRequest): string {
  const { word, language } = request;

  return `You are a religiously unbiased biblical scholar providing detailed linguistic analysis of the ${language} word "${word}". Format your response with clear sections using the following structure:

**Word**
[Show the ${language} word "${word}" in its original script]
[Provide the transliteration]

**Grammar**
[Root, Part of speech, gender, number, case (if Greek)]

**English Translation**
[Provide the closest English translation(s) of the Root, then the ${word}]

**Other Occurrences**
[Cite this word's first occurrence in the Bible with just the relevant snippet containing the word in the original ${language} script, followed by as many (max 3) other relevant appearances that show diverse nuances of the word. For each occurrence, provide:
1. The reference (book chapter:verse)
2. The snippet in original ${language} containing the word - IMPORTANT: Wrap the target word "${word}" in **bold** markdown like this: **${word}**
3. The English translation of that snippet on a new line - also bold the English translation of the target word
Format each occurrence as: Reference: ${language} snippet → English translation]

NO FLUFF.FOLLOW INSTRUCTIONS CAREFULLY. Remember: the word being analyzed is "${word}" in ${language}.`;
}
