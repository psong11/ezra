/**
 * Guards against a hallucinated or malformed morpheme breakdown: segments
 * must concatenate, in order, to the surface word. Used both server-side
 * (before caching) and client-side (before coloring a still-streaming
 * word), so a bad breakdown degrades to plain text instead of visibly
 * wrong or shifting spans.
 *
 * Comparison strips niqqud/cantillation (Hebrew) and accents (Greek, via
 * NFD) rather than requiring an exact byte match — models reliably keep
 * consonants in order but occasionally drop or shift a single vowel point
 * across a segment boundary, which is invisible to a reader and not worth
 * discarding a correct breakdown over. A wrong, missing, or reordered
 * consonant still fails the check.
 */

interface SegmentLike {
  text?: string;
}

// Hebrew niqqud/cantillation block (0591-05C7) plus Greek combining
// diacriticals (0300-036F), which only appear after NFD-decomposing a
// precomposed accented letter such as U+03AC ("ά").
const COMBINING_MARKS = new RegExp('[\\u0591-\\u05C7\\u0300-\\u036F]', 'g');

function consonantSkeleton(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS, '');
}

export function segmentsReconstructWord(
  word: string | undefined,
  segments: (SegmentLike | undefined)[] | undefined
): boolean {
  if (!word || !segments || segments.length === 0) return false;
  if (segments.some(s => !s?.text)) return false;
  const joined = segments.map(s => s!.text).join('');
  return consonantSkeleton(joined) === consonantSkeleton(word);
}
