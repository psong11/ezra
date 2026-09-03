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
- grammar: give the root in its original script with transliteration; include gender/number only when applicable, and case only for Greek. Set stem to the Hebrew binyan or Greek voice+mood+tense if this word is a verb, else null.
- rootMeanings / wordMeanings: closest English translations, most common first.
- occurrences: cite this word's FIRST occurrence in the Bible, then 3 more verses where the SAME root appears — other inflections, persons, and binyanim/tenses are encouraged (they show the root's range); famous or formative verses are ideal. What is forbidden is citing a verse that only uses a synonym from a DIFFERENT root. Use full English book names with real chapter and verse numbers. Quote a phrase of roughly 8-12 words of the original ${language}, with a few words of context BEFORE and AFTER the word whenever the verse allows (never the whole verse), and ALWAYS wrap the form as it appears in that verse in **double asterisks**, in both the snippet and its English translation, even when it is inflected differently from "${word}".
- morphemes is REQUIRED and must never be an empty array: split "${word}" itself into contiguous segments, in original order, that together cover the whole word. Every segment must contain at least one consonant (Hebrew) or letter (Greek) — NEVER emit a segment that is only vowel points, dagesh, or accents; each mark stays attached to the consonant it follows. Never split the root's consonants apart or reorder anything. For a Hebrew wayyiqtol form like וַיִּכְתֹּב, segment it as the vav-consecutive with its vowel (וַ, affix, gloss like "and (then)"), the subject prefix (יִּ, modifier, gloss like "he"), and the root with its own vowels (כְתֹּב, root). Nouns carry morphology too — segment their attached pieces rather than lumping the word into one chunk: prefixed conjunction/article/prepositions (וְ, הַ, בְּ, לְ, כְּ, מִ — affix), and endings such as the feminine ה/ת, construct forms, plural ים/וֹת, dual ַיִם, and pronominal suffixes (וֹ "his", ָם "their" — modifier). Only a word that genuinely has no attached affix (e.g. סֵפֶר) should be one root segment.
- meaningBridge is REQUIRED (not null) whenever grammar.stem is non-null — the two must always agree: if you name a binyan or voice/tense-aspect in stem, you must explain what it adds in meaningBridge. Only use null for plain nouns and particles where stem is also null. Keep rootSense, patternNuance, and combinedMeaning to a few words each. combinedMeaning must be the word's actual idiomatic meaning in this verse — how a good translation renders it — never a wooden mechanical composition (for a Hifil of חזק write "he seized", NOT "he caused to be strong"; when the stem's textbook function and the idiomatic sense differ, the idiom wins and the note explains the connection). Write "note" as a teacher would say it out loud, tied to a concrete image of the word in use — and if you use any grammar jargon in it, end that same sentence by busting the jargon in plain words a total beginner would understand.`;
}
