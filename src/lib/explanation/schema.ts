/**
 * Typed shape of a word study. Shared by the API route (generation +
 * validation before caching) and the client (partial-object rendering).
 */

import { z } from 'zod';

export const occurrenceSchema = z.object({
  book: z.string().describe('Full English book name, e.g. "Genesis" or "1 Samuel"'),
  chapter: z.number().int().describe('Chapter number'),
  verse: z.number().int().describe('Verse number'),
  snippet: z
    .string()
    .describe(
      'Short snippet in the original language containing the word. Wrap the target word in **double asterisks**.'
    ),
  translation: z
    .string()
    .describe(
      'English translation of the snippet. Wrap the translation of the target word in **double asterisks**.'
    ),
});

export const wordStudySchema = z.object({
  word: z.string().describe('The word in its original script'),
  transliteration: z.string().describe('Latin-alphabet transliteration of the word'),
  // Note: OpenAI strict structured outputs require every field to be present,
  // so "not applicable" is expressed as null rather than an absent key
  grammar: z.object({
    root: z.string().describe('The root in its original script'),
    rootTransliteration: z.string().describe('Latin-alphabet transliteration of the root'),
    partOfSpeech: z.string().describe('e.g. Noun, Verb, Preposition'),
    gender: z.string().nullable().describe('Masculine/Feminine/Neuter, or null if not applicable'),
    number: z.string().nullable().describe('Singular/Plural/Dual, or null if not applicable'),
    grammaticalCase: z
      .string()
      .nullable()
      .describe('Nominative/Genitive/Dative/Accusative/Vocative — Greek only, null for Hebrew'),
  }),
  rootMeanings: z
    .array(z.string())
    .describe('Closest English translations of the root, most common first'),
  wordMeanings: z
    .array(z.string())
    .describe('Closest English translations of this exact inflected form'),
  occurrences: z
    .array(occurrenceSchema)
    .describe(
      "This word's first occurrence in the Bible, then up to 3 other appearances showing diverse nuances"
    ),
});

export type WordStudy = z.infer<typeof wordStudySchema>;
export type Occurrence = z.infer<typeof occurrenceSchema>;

/**
 * Shape of a word study while it is still streaming — every field may be
 * absent and array elements may themselves be incomplete. Kept local so
 * the UI doesn't depend on SDK-internal DeepPartial types.
 */
export interface PartialWordStudy {
  word?: string;
  transliteration?: string;
  grammar?: Partial<WordStudy['grammar']>;
  rootMeanings?: (string | undefined)[];
  wordMeanings?: (string | undefined)[];
  occurrences?: (Partial<Occurrence> | undefined)[];
}
