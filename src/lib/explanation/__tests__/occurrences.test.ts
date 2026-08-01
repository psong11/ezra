import { describe, it, expect } from 'vitest';
import { tightenOccurrenceText } from '../occurrences';

describe('tightenOccurrenceText', () => {
  it('leaves a short, already-bolded snippet unchanged', () => {
    const s = 'וַאֲשֵׁירֵהֶם֙ **תְּגַדֵּע֑וּן**';
    expect(tightenOccurrenceText(s, {})).toBe(s);
  });

  it('clips a whole-verse snippet to a window around the bold, with ellipses', () => {
    const words = Array.from({ length: 20 }, (_, i) => `w${i}`);
    words[10] = '**target**';
    const out = tightenOccurrenceText(words.join(' '), { before: 2, after: 2 });
    expect(out).toBe('… w8 w9 **target** w11 w12 …');
  });

  it('keeps the full multi-token bold plus context', () => {
    const out = tightenOccurrenceText(
      'a b c d **you shall cut down** e f g h',
      { before: 1, after: 1 }
    );
    expect(out).toBe('… d **you shall cut down** e …');
  });

  it('auto-bolds the token matching the studied word by consonant skeleton', () => {
    // Real production case (2 Kings 18:4-style): model quoted the verse but
    // skipped the bold. The token differs from the studied form only in
    // pointing, so the skeleton match finds and bolds it.
    const out = tightenOccurrenceText('וְכִתַּת נְחַשׁ הַנְּחֹשֶׁת וַיַּחֲזֶק בּוֹ', {
      word: 'וַיַּ֣חֲזֶק',
    });
    expect(out).toContain('**וַיַּחֲזֶק**');
  });

  it('falls back to the root when the exact form is absent (different inflection)', () => {
    const out = tightenOccurrenceText('וַיְגַדְּעוּ אֶת־הָאֲשֵׁרִים', {
      word: 'תְּגַדְּע֑וּן',
      root: 'גדע',
    });
    expect(out).toContain('**וַיְגַדְּעוּ**');
  });

  it('strips a wrong-root bold and re-anchors to the correct token', () => {
    // Formulaic-synonym conflation: model bolds יָחוּס (root חוס) when the
    // studied root is חמל, even though the right word is in the quote.
    const out = tightenOccurrenceText('וְלֹא **יָחוּס** וְלֹא יַחְמֹל עֲלֵיהֶם', {
      word: 'אֶחְמֹל',
      root: 'חמל',
    });
    expect(out).toContain('**יַחְמֹל**');
    expect(out).not.toContain('**יָחוּס**');
  });

  it('returns unbolded text when the model bolded a synonym and the root is absent', () => {
    // Real production case (Ezekiel 5:11 cited for root חנן): the quote
    // contains only אֶחְמֹל (root חמל). Stripping the wrong bold leaves no
    // ** marker, which is the signal for the route to drop the citation.
    const out = tightenOccurrenceText('וְלֹא **אֶחְמֹל** וְלֹא אָחוּס עֲלֵיהֶם', {
      word: 'תְחָנֵּם',
      root: 'חנן',
    });
    expect(out).not.toContain('**');
  });

  it('keeps a model bold on a weak-root inflection missing a radical', () => {
    // Geminate root חנן appears as יָחֹן (two radicals visible) — the
    // consecutive-radical-pair check must accept it, not strip it.
    const out = tightenOccurrenceText('כִּי לֹא **יָחֹן** אֹתָם עֹשֵׂהוּ', {
      word: 'תְחָנֵּם',
      root: 'חנן',
    });
    expect(out).toContain('**יָחֹן**');
  });

  it('leaves translation bolds alone when no word/root is given to verify against', () => {
    const s = 'and I will not **spare** them at all';
    expect(tightenOccurrenceText(s, { before: 6, after: 6 })).toBe(s);
  });

  it('prefers a token exactly equal to the root over one merely containing it', () => {
    // Genesis 1:1: the root ברא is a consonant-substring of בְּרֵאשִׁית,
    // which appears first — exact equality must outrank containment or
    // "in the beginning" gets bolded instead of the verb "created".
    const out = tightenOccurrenceText('בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם', {
      word: 'וַיִּבְרָא',
      root: 'ברא',
    });
    expect(out).toContain('**בָּרָ֣א**');
    expect(out).not.toContain('**בְּרֵאשִׁ֖ית**');
  });

  it('matches a root ending in a final form against its medial inflection', () => {
    // Root הלך ends in final kaf; inside הָלְכוּ the kaf is medial — the
    // skeleton must fold final forms or this legitimate citation is missed.
    const out = tightenOccurrenceText('וְהָלְכוּ עַמִּים רַבִּים', {
      word: 'הִתְהַלֵּךְ',
      root: 'הלך',
    });
    expect(out).toContain('**וְהָלְכוּ**');
  });

  it('returns text untouched when there is no bold and nothing matches', () => {
    const s = 'no target word here at all';
    expect(tightenOccurrenceText(s, { word: 'שָׁלוֹם', root: 'שלם' })).toBe(s);
  });

  it('handles empty and whitespace-only input', () => {
    expect(tightenOccurrenceText('', {})).toBe('');
    expect(tightenOccurrenceText('   ', {})).toBe('   ');
  });
});
