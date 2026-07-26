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

export const morphemeSegmentSchema = z.object({
  text: z
    .string()
    .describe(
      'Exact contiguous substring of the word in its original script. Concatenating every segment in order must reproduce the full word exactly, with nothing added, removed, or reordered.'
    ),
  type: z
    .enum(['root', 'modifier', 'affix'])
    .describe(
      'root = the lexical core carrying the base meaning. modifier = the piece that changes meaning or function — a Hebrew binyan/stem pattern, a Greek voice/tense-aspect marker, a possessive or personal-ending suffix. affix = a simple additive particle that does not change the core sense, e.g. a conjunction ("and"), relative ("that"), or a Greek augment.'
    ),
  gloss: z
    .string()
    .describe('A few-word plain-English gloss of just this piece, e.g. "and", "his", "past-tense marker"'),
});

export const meaningBridgeSchema = z.object({
  rootSense: z.string().describe('The bare root meaning in a few words, e.g. "go, walk"'),
  patternNuance: z
    .string()
    .describe(
      'What the binyan/stem or voice/tense-aspect adds to the root, in a few words, e.g. "reflexive, back-and-forth"'
    ),
  combinedMeaning: z
    .string()
    .describe(
      'The resulting combined meaning of root + pattern, as plain text with no quotation marks of your own, e.g. walked about'
    ),
  note: z
    .string()
    .describe(
      'One brief sentence in plain English explaining how the root and pattern combine into this meaning, grounded in a concrete usage rather than abstract grammar talk. If the sentence uses any grammatical jargon (e.g. Niphal, Hifil, causative, aorist, factitive, augment), it MUST end with a short additional clause busting that exact jargon in plain terms a reader with zero grammar background can follow.'
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
    stem: z
      .string()
      .nullable()
      .describe(
        'For Hebrew verbs, the binyan (Qal/Niphal/Piel/Pual/Hifil/Hofal/Hitpael). For Greek verbs, voice + mood + tense (e.g. "Aorist active indicative"). Null if the word is not a verb.'
      ),
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
  morphemes: z
    .array(morphemeSegmentSchema)
    .describe(
      'Break the word into its contiguous morpheme segments (at least one — the whole word tagged "root" if it has no separable affix or pattern).'
    ),
  meaningBridge: meaningBridgeSchema
    .nullable()
    .describe(
      'Null when the word is a simple noun/particle where a root+pattern breakdown would not add insight. Present whenever a binyan, voice, or tense-aspect meaningfully shapes the word\'s sense.'
    ),
});

export type WordStudy = z.infer<typeof wordStudySchema>;
export type Occurrence = z.infer<typeof occurrenceSchema>;
export type MorphemeSegment = z.infer<typeof morphemeSegmentSchema>;
export type MeaningBridge = z.infer<typeof meaningBridgeSchema>;

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
  morphemes?: (Partial<MorphemeSegment> | undefined)[];
  meaningBridge?: Partial<MeaningBridge> | null;
}
