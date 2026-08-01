import { describe, it, expect } from 'vitest';
import { alignSegmentsToWord, consonantSkeleton } from '../morphemes';

describe('consonantSkeleton', () => {
  it('strips Hebrew niqqud, dagesh, and cantillation', () => {
    expect(consonantSkeleton('וַיַּ֣חֲזֶק')).toBe('ויחזק');
  });

  it('strips Greek accents and breathings via NFD', () => {
    expect(consonantSkeleton('ἐλύσατο')).toBe('ελυσατο');
  });
});

describe('alignSegmentsToWord', () => {
  it('slices the original word so display keeps marks the model dropped', () => {
    // Real production case: the model dropped the dagesh and cantillation
    // from its segment copies. Aligned output must restore them, because
    // the text is sliced from the surface word, not taken from the model.
    const word = 'וַיַּ֣חֲזֶק';
    const aligned = alignSegmentsToWord(word, [
      { text: 'ו', type: 'affix', gloss: 'and' },
      { text: 'י', type: 'modifier', gloss: 'he' },
      { text: 'חֲזֶק', type: 'root', gloss: 'seize' },
    ]);
    expect(aligned).not.toBeNull();
    expect(aligned!.map(s => s.text).join('')).toBe(word);
  });

  it('folds a bare-vowel segment into the previous visible segment', () => {
    // Real production case: a floating patach emitted as its own segment.
    // It has no consonant to live under, so it gets no span — its gloss
    // merges into the segment whose cluster physically holds the mark.
    const word = 'וַיַּ֣חֲזֶק';
    const aligned = alignSegmentsToWord(word, [
      { text: 'ו', type: 'affix', gloss: 'and' },
      { text: 'ַ', type: 'affix', gloss: 'past-tense marker' },
      { text: 'י', type: 'affix', gloss: 'he' },
      { text: 'חֲזֶק', type: 'root', gloss: 'seize' },
    ]);
    expect(aligned).not.toBeNull();
    expect(aligned!.length).toBe(3);
    expect(aligned![0].gloss).toBe('and · past-tense marker');
    expect(aligned!.map(s => s.text).join('')).toBe(word);
  });

  it('aligns a Hitpael split and preserves the surface form', () => {
    const word = 'הִתְהַלֵּךְ';
    const aligned = alignSegmentsToWord(word, [
      { text: 'הִתְ', type: 'modifier', gloss: 'reflexive pattern' },
      { text: 'הַלֵּךְ', type: 'root', gloss: 'walk' },
    ]);
    expect(aligned).not.toBeNull();
    expect(aligned!.map(s => s.text)).toEqual(['הִתְ', 'הַלֵּךְ']);
  });

  it('keeps trailing punctuation (sof pasuq) attached to the last slice', () => {
    const aligned = alignSegmentsToWord('אֹתֽוֹ׃', [{ text: 'אֹתוֹ', type: 'root', gloss: 'him' }]);
    expect(aligned).not.toBeNull();
    expect(aligned![0].text).toBe('אֹתֽוֹ׃');
  });

  it('aligns Greek segments across composed accented letters', () => {
    const word = 'ἐλύσατο';
    const aligned = alignSegmentsToWord(word, [
      { text: 'ἐ', type: 'affix', gloss: 'past marker' },
      { text: 'λύ', type: 'root', gloss: 'loose' },
      { text: 'σατο', type: 'modifier', gloss: 'he, for himself' },
    ]);
    expect(aligned).not.toBeNull();
    expect(aligned!.map(s => s.text).join('')).toBe(word);
  });

  it('rejects segments that drop a consonant', () => {
    expect(
      alignSegmentsToWord('הִתְהַלֵּךְ', [{ text: 'הִתְ' }, { text: 'הך' }])
    ).toBeNull();
  });

  it('rejects segments with a wrong consonant', () => {
    expect(
      alignSegmentsToWord('הִתְהַלֵּךְ', [{ text: 'הִתְ' }, { text: 'קַלֵּךְ' }])
    ).toBeNull();
  });

  it('rejects reordered segments', () => {
    expect(alignSegmentsToWord('ab', [{ text: 'b' }, { text: 'a' }])).toBeNull();
  });

  it('rejects segments that cover too little or too much of the word', () => {
    expect(alignSegmentsToWord('שָׁלוֹם', [{ text: 'שָׁל' }])).toBeNull();
    expect(alignSegmentsToWord('שָׁלוֹם', [{ text: 'שָׁלוֹם' }, { text: 'עוֹד' }])).toBeNull();
  });

  it('rejects empty, missing, or blank inputs', () => {
    expect(alignSegmentsToWord(undefined, [{ text: 'a' }])).toBeNull();
    expect(alignSegmentsToWord('a', undefined)).toBeNull();
    expect(alignSegmentsToWord('a', [])).toBeNull();
    expect(alignSegmentsToWord('a', [{ text: 'a' }, {}])).toBeNull();
    expect(alignSegmentsToWord('a', [{ text: '' }])).toBeNull();
  });

  it('accepts a single whole-word root segment', () => {
    const aligned = alignSegmentsToWord('λόγος', [{ text: 'λόγος', type: 'root', gloss: 'word' }]);
    expect(aligned).not.toBeNull();
    expect(aligned![0].text).toBe('λόγος');
  });
});
