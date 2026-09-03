/**
 * Morpheme-segment alignment.
 *
 * The model's segments are treated as *boundary hints*, never as display
 * text: we verify each segment's consonant skeleton against the surface
 * word and then slice the ORIGINAL word into those boundaries. Rendering
 * slices of the real word makes display letter-perfect by construction —
 * a dropped dagesh or cantillation mark in the model's copy is restored
 * from the source text, and a hallucinated consonant fails alignment so
 * the UI degrades to plain text instead of showing a corrupted word.
 *
 * Hebrew-script rule enforced here: combining marks (niqqud, dagesh,
 * cantillation) always belong to the consonant they follow. A segment the
 * model emits with no consonant at all (e.g. a floating patach glossed
 * "past-tense marker") gets no span of its own — its gloss folds into the
 * previous visible segment, which is where its mark physically lives.
 */

import type { MorphemeSegment } from './schema';

// Hebrew points/accents block (U+0591-U+05C7, which also covers maqqef and
// sof pasuq — harmless to treat as marks here) plus Greek combining
// diacriticals (U+0300-U+036F), present after NFD decomposition.
const COMBINING_MARKS = new RegExp('[\\u0591-\\u05C7\\u0300-\\u036F]', 'g');

// Final letter forms fold to their medial forms so a root ending in ך/ם/ן/ף/ץ
// still matches when it appears mid-word in an inflected form (e.g. root הלך
// inside הָלְכוּ, where the kaf is medial).
const FINAL_FORMS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

export function consonantSkeleton(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      // Drop everything that isn't a letter. Critical for roots: models
      // write them in the traditional dotted form (ח.י.ה), and those ASCII
      // periods would otherwise survive and make the root match nothing,
      // silently disabling root-based lookup. Also clears maqqef, sof
      // pasuq, and stray punctuation in corpus tokens.
      .replace(/[^\p{L}]/gu, '')
      .replace(/[ךםןףץ]/g, ch => FINAL_FORMS[ch])
  );
}

export interface AlignedSegment {
  text: string;
  type?: MorphemeSegment['type'];
  gloss?: string;
}

interface SegmentLike {
  text?: string;
  type?: MorphemeSegment['type'];
  gloss?: string;
}

/**
 * Split a word into grapheme clusters of one base letter plus every
 * combining mark that follows it. Leading marks (rare, malformed input)
 * attach to the first real cluster.
 */
function splitClusters(word: string): string[] {
  const out: string[] = [];
  let prefix = '';
  for (const ch of word) {
    if (consonantSkeleton(ch) === '') {
      if (out.length === 0) prefix += ch;
      else out[out.length - 1] += ch;
    } else {
      out.push(ch);
    }
  }
  if (out.length > 0 && prefix) out[0] = prefix + out[0];
  return out;
}

/**
 * Verify the segments against the surface word and return display-ready
 * segments whose text is sliced from the word itself. Returns null when
 * the segments don't faithfully cover the word (wrong, missing, extra, or
 * reordered letters) — callers must then fall back to uncolored text.
 */
export function alignSegmentsToWord(
  word: string | undefined,
  segments: (SegmentLike | undefined)[] | undefined
): AlignedSegment[] | null {
  if (!word || !segments || segments.length === 0) return null;
  if (segments.some(s => !s || typeof s.text !== 'string' || s.text.length === 0)) return null;

  const clusters = splitClusters(word);
  if (clusters.length === 0) return null;

  const aligned: AlignedSegment[] = [];
  let taken = 0;

  for (const seg of segments as SegmentLike[]) {
    const skeleton = consonantSkeleton(seg.text as string);

    if (skeleton.length === 0) {
      const previous = aligned[aligned.length - 1];
      if (previous && seg.gloss) {
        previous.gloss = previous.gloss ? `${previous.gloss} · ${seg.gloss}` : seg.gloss;
      }
      continue;
    }

    const slice = clusters.slice(taken, taken + skeleton.length);
    if (slice.length < skeleton.length) return null;

    const text = slice.join('');
    if (consonantSkeleton(text) !== skeleton) return null;

    aligned.push({ text, type: seg.type, gloss: seg.gloss });
    taken += skeleton.length;
  }

  if (taken !== clusters.length) return null;
  return aligned.length > 0 ? aligned : null;
}
