/**
 * Occurrence-snippet hygiene: keep quoted verses short and the target word
 * always highlighted, regardless of how well the model behaved.
 *
 * The model is instructed to quote a short phrase and wrap the cited form
 * in **bold**, but it reliably fails in two ways: it quotes whole verses,
 * and it skips the bold when the verse contains a different inflection of
 * the root than the exact form being studied. Rather than render those
 * failures, this module repairs them deterministically:
 *
 *   1. If no **bold** marker is present, find the token whose consonant
 *      skeleton contains the studied word's skeleton (or, failing that,
 *      the root's) and bold it ourselves.
 *   2. Clip the text to a window of tokens around the bolded target, with
 *      ellipses marking what was cut.
 *
 * Pure string-in/string-out so it runs both server-side (normalizing what
 * gets cached) and client-side (repairing a still-streaming MISS live).
 */

import { consonantSkeleton } from './morphemes';

interface TightenOptions {
  /** Exact studied form — matched first, by consonant skeleton. */
  word?: string;
  /** Root consonants — fallback match for differently-inflected citations. */
  root?: string | null;
  /** Tokens kept before the (first) bolded token. */
  before?: number;
  /** Tokens kept after the (last) bolded token. */
  after?: number;
}

/**
 * How many of the root's radicals appear in the token IN ORDER (they need
 * not be adjacent). Weak Hebrew roots lose a radical under inflection —
 * III-he ראה becomes וַיַּרְא, I-nun נגע becomes תִּגַּע, geminate חנן
 * becomes יָחֹן — so a form can legitimately show only two of three.
 */
function orderedRadicalScore(tokenSkeleton: string, rootSkeleton: string): number {
  let count = 0;
  let pos = 0;
  for (const radical of rootSkeleton) {
    const at = tokenSkeleton.indexOf(radical, pos);
    if (at !== -1) {
      count += 1;
      pos = at + 1;
    }
  }
  return count;
}

/**
 * Does the token keep two ADJACENT radicals of the root side by side?
 * Inflection strips radicals from the edges of weak roots but rarely
 * splits the surviving core apart, so this is the signal that separates a
 * real relative (וַיַּרְא keeps רא of ראה; תִּגַּע keeps גע of נגע) from a
 * word that merely happens to reuse two common letters (אַתָּה shares א
 * and ה with ראה but never adjacently).
 */
function sharesAdjacentRadicals(tokenSkeleton: string, rootSkeleton: string): boolean {
  for (let i = 0; i < rootSkeleton.length - 1; i++) {
    if (tokenSkeleton.includes(rootSkeleton.slice(i, i + 2))) return true;
  }
  return false;
}

/**
 * Locate the token derived from the studied word/root, strongest evidence
 * first: the exact surface form, then the bare root, then the root as a
 * substring, and finally the root FAMILY — a form sharing all but one
 * radical, in order. That last tier is what surfaces other inflections of
 * the same root, which is the entire point of an occurrence list; without
 * it only verbatim copies of the studied form ever highlight.
 *
 * A family candidate must keep two adjacent radicals AND carry all but
 * one radical in order; among those, the best wins, ties going to the
 * shortest skeleton — the least-affixed, most root-like word. That is
 * what keeps a study of ראה off וַתִּקְרָא (root קרא, which merely
 * contains "רא") when a real רֳאִי sits in the verse, and off אַתָּה,
 * which shares א and ה with ראה but never side by side. Synonyms from
 * unrelated roots stay rejected — חמל and חוס share one radical with חנן.
 */
export function locateTargetToken(
  tokens: string[],
  word?: string,
  root?: string | null
): number {
  const skeletons = tokens.map(t => consonantSkeleton(t));
  const wordSkeleton = word ? consonantSkeleton(word) : '';
  if (wordSkeleton) {
    const byWord = skeletons.findIndex(s => s.includes(wordSkeleton));
    if (byWord !== -1) return byWord;
  }
  const rootSkeleton = root ? consonantSkeleton(root) : '';
  if (rootSkeleton.length >= 2) {
    // Exact skeleton equality outranks containment: the root ברא is a
    // consonant-substring of בראשית, so in Genesis 1:1 containment alone
    // would bold "in the beginning" instead of the bare verb "created".
    const exact = skeletons.findIndex(s => s === rootSkeleton);
    if (exact !== -1) return exact;
    const byRoot = skeletons.findIndex(s => s.includes(rootSkeleton));
    if (byRoot !== -1) return byRoot;
  }
  if (rootSkeleton.length >= 3) {
    const required = Math.max(2, rootSkeleton.length - 1);
    let best = -1;
    let bestScore = 0;
    let bestLength = Infinity;
    skeletons.forEach((skeleton, i) => {
      if (!sharesAdjacentRadicals(skeleton, rootSkeleton)) return;
      const score = orderedRadicalScore(skeleton, rootSkeleton);
      if (score < required) return;
      if (score > bestScore || (score === bestScore && skeleton.length < bestLength)) {
        best = i;
        bestScore = score;
        bestLength = skeleton.length;
      }
    });
    if (best !== -1) return best;
  }
  return -1;
}

function findTargetToken(tokens: string[], word?: string, root?: string | null): number {
  return locateTargetToken(tokens, word, root);
}

function boldMatchesTarget(boldTokens: string[], word?: string, root?: string | null): boolean {
  return locateTargetToken(boldTokens, word, root) !== -1;
}

export function tightenOccurrenceText(text: string, options: TightenOptions = {}): string {
  const { word, root, before = 5, after = 5 } = options;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;

  // The bold may span several tokens ("**you shall cut down**") — the kept
  // window must cover from the opening marker through the closing one.
  let first = tokens.findIndex(t => t.includes('**'));
  let last = -1;
  if (first !== -1) {
    for (let i = tokens.length - 1; i >= first; i--) {
      if (tokens[i].includes('**')) {
        last = i;
        break;
      }
    }
  }

  // Never trust a model-provided bold when we can check it: in formulaic
  // passages the model conflates synonymous roots (חוס/חמל/חנן) and bolds
  // the wrong word. If none of the bolded tokens plausibly derive from the
  // studied word or root, strip the bolds and re-anchor ourselves.
  if (first !== -1 && (word || root)) {
    if (!boldMatchesTarget(tokens.slice(first, last + 1), word, root)) {
      for (let i = 0; i < tokens.length; i++) tokens[i] = tokens[i].replace(/\*\*/g, '');
      first = last = -1;
    }
  }

  if (first === -1) {
    const target = findTargetToken(tokens, word, root);
    // No verifiable anchor: return unbolded text — the route drops such
    // citations from the cache and the client hides long unbolded quotes.
    if (target === -1) return tokens.join(' ');
    tokens[target] = `**${tokens[target]}**`;
    first = last = target;
  }

  const start = Math.max(0, first - before);
  const end = Math.min(tokens.length, last + after + 1);
  const clipped = tokens.slice(start, end).join(' ');
  return `${start > 0 ? '… ' : ''}${clipped}${end < tokens.length ? ' …' : ''}`;
}
