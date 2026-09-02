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
      'A phrase of roughly 8-12 words from the verse in the original language — a few words of context before AND after the target word, never the whole verse. Must contain the form of the word as it actually appears in that verse, wrapped in **double asterisks** (bold it even when it is a different inflection of the same root — but never bold a mere synonym from a different root).'
    ),
  translation: z
    .string()
    .describe(
      'English translation of just that short phrase, with the rendering of the target word wrapped in **double asterisks**.'
    ),
});

export const morphemeSegmentSchema = z.object({
  text: z
    .string()
    .describe(
      'Exact contiguous substring of the word in its original script, containing at least one consonant/letter — never vowel points or accents alone; marks stay attached to the consonant they follow. Concatenating every segment in order must reproduce the full word with nothing added, removed, or reordered.'
    ),
  type: z
    .enum(['root', 'modifier', 'affix'])
    .describe(
      'root = the lexical core (Hebrew shoresh with its vowels; Greek verb stem). modifier = inflectional or derivational morphology that shapes meaning or function — Hebrew binyan markers (הִ, הִתְ, נִ), subject prefixes/endings of conjugation (יִ "he", תִי "I"), possessive suffixes (וֹ "his"), Greek tense/voice suffixes and personal endings (σα, θη, μεν). affix = an attached particle that is semantically a separate little word — conjunction ו "and", article ה "the", prepositions בְ/לְ/כְ/מִ, relative שֶׁ, or the Greek augment ἐ.'
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
      "The word's actual idiomatic meaning in context — how a good translation renders it, e.g. walked about, he seized — never a wooden mechanical composition like caused to be strong. Plain text, no quotation marks of your own."
    ),
  note: z
    .string()
    .describe(
      'One brief sentence in plain English explaining how the root and pattern combine into this meaning, grounded in a concrete usage rather than abstract grammar talk. If the sentence uses any grammatical jargon (e.g. Niphal, Hifil, causative, aorist, factitive, augment), it MUST end with a short additional clause busting that exact jargon in plain terms a reader with zero grammar background can follow.'
    ),
});

// Field order below = panel display order. Structured outputs stream JSON
// properties in schema declaration order, so this is what makes the panel
// fill top-to-bottom as tokens arrive — the token-heavy occurrences array
// must stay LAST or everything above it pops in at the end.
export const wordStudySchema = z.object({
  word: z.string().describe('The word in its original script'),
  transliteration: z.string().describe('Latin-alphabet transliteration of the word'),
  morphemes: z
    .array(morphemeSegmentSchema)
    .min(1)
    .describe(
      'Break the word into its contiguous morpheme segments (at least one — the whole word tagged "root" if it has no separable affix or pattern).'
    ),
  meaningBridge: meaningBridgeSchema
    .nullable()
    .describe(
      'Null when the word is a simple noun/particle where a root+pattern breakdown would not add insight. Present whenever a binyan, voice, or tense-aspect meaningfully shapes the word\'s sense.'
    ),
  // Note: strict structured-output modes require every field to be present,
  // so "not applicable" is expressed as null rather than an absent key
  grammar: z.object({
    root: z.string().describe('The root in its original script'),
    rootTransliteration: z.string().describe('Latin-alphabet transliteration of the root'),
    partOfSpeech: z.string().describe('e.g. Noun, Verb, Preposition'),
    stem: z
      .string()
      .nullable()
      .describe(
        'For Hebrew verbs, the binyan (Qal/Niphal/Piel/Pual/Hifil/Hofal/Hitpael). For Greek verbs, voice + mood + tense (e.g. "Aorist active indicative"). Null if the word is not a verb.'
      ),
    gender: z.string().nullable().describe('Masculine/Feminine/Neuter, or null if not applicable'),
    number: z.string().nullable().describe('Singular/Plural/Dual, or null if not applicable'),
    grammaticalCase: z
      .string()
      .nullable()
      .describe('Nominative/Genitive/Dative/Accusative/Vocative — Greek only, null for Hebrew'),
  }),
  wordMeanings: z
    .array(z.string())
    .describe('Closest English translations of this exact inflected form'),
  rootMeanings: z
    .array(z.string())
    .describe('Closest English translations of the root, most common first'),
  occurrences: z
    .array(occurrenceSchema)
    .describe(
      "This word's first occurrence in the Bible, then up to 3 other appearances showing diverse nuances"
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
