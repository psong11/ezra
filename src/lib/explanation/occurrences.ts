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

function findTargetToken(tokens: string[], word?: string, root?: string | null): number {
  const wordSkeleton = word ? consonantSkeleton(word) : '';
  if (wordSkeleton) {
    const byWord = tokens.findIndex(t => consonantSkeleton(t).includes(wordSkeleton));
    if (byWord !== -1) return byWord;
  }
  const rootSkeleton = root ? consonantSkeleton(root) : '';
  if (rootSkeleton.length >= 2) {
    return tokens.findIndex(t => consonantSkeleton(t).includes(rootSkeleton));
  }
  return -1;
}

/**
 * Looser check used only to VERIFY a bold the model itself placed (never to
 * auto-anchor): weak Hebrew roots drop or assimilate a radical in many
 * inflections — geminate חנן appears as יָחֹן, נתן as יִתֵּן, הלך as
 * וַיֵּלֶךְ — so strict containment would reject legitimate citations.
 * Sharing any two CONSECUTIVE radicals admits those inflections while
 * still rejecting synonyms from unrelated roots (חמל/חוס share no
 * consecutive pair with חנן).
 */
function boldMatchesTarget(boldTokens: string[], word?: string, root?: string | null): boolean {
  if (findTargetToken(boldTokens, word, root) !== -1) return true;
  const rootSkeleton = root ? consonantSkeleton(root) : '';
  if (rootSkeleton.length < 3) return false;
  const radicalPairs: string[] = [];
  for (let i = 0; i < rootSkeleton.length - 1; i++) {
    radicalPairs.push(rootSkeleton.slice(i, i + 2));
  }
  return boldTokens.some(token => {
    const s = consonantSkeleton(token);
    return radicalPairs.some(pair => s.includes(pair));
  });
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
