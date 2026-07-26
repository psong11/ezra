/**
 * Guards against a hallucinated or malformed morpheme breakdown: segments
 * must concatenate, in order, to exactly the surface word. Used both
 * server-side (before caching) and client-side (before coloring a
 * still-streaming word), so a bad breakdown degrades to plain text instead
 * of visibly wrong or shifting spans.
 */

interface SegmentLike {
  text?: string;
}

export function segmentsReconstructWord(
  word: string | undefined,
  segments: (SegmentLike | undefined)[] | undefined
): boolean {
  if (!word || !segments || segments.length === 0) return false;
  if (segments.some(s => !s?.text)) return false;
  return segments.map(s => s!.text).join('') === word;
}
