import { describe, it, expect } from 'vitest';
import { segmentsReconstructWord } from '../morphemes';

describe('segmentsReconstructWord', () => {
  it('accepts segments that concatenate to the exact word', () => {
    expect(
      segmentsReconstructWord('הִתְהַלֵּךְ', [{ text: 'הִתְ' }, { text: 'הַלֵּךְ' }])
    ).toBe(true);
  });

  it('tolerates a niqqud mark dropped across a segment boundary', () => {
    // Real model output: dagesh forte (U+05BC) on the root's first letter
    // went missing when the prefix/root split was drawn — consonants and
    // every other vowel point are untouched, so this should still color.
    const word = 'וַיַּחֲזֶק'; // ו-ַ-י-ַ-ּ(dagesh)-ח-ֲ-ז-ֶ-ק
    const segments = [{ text: 'וַי' }, { text: 'ַחֲזֶק' }]; // dagesh dropped
    expect(segmentsReconstructWord(word, segments)).toBe(true);
  });

  it('tolerates Greek accents shifting across NFD-decomposed boundaries', () => {
    expect(segmentsReconstructWord('ἐλύσατο', [{ text: 'ἐ' }, { text: 'λύσατο' }])).toBe(true);
  });

  it('rejects segments that drop a consonant', () => {
    // 'הך' is missing the lamed (ל) present in the real word — a genuine
    // hallucination, not a vowel-point rounding difference.
    expect(segmentsReconstructWord('הִתְהַלֵּךְ', [{ text: 'הִתְ' }, { text: 'הך' }])).toBe(false);
  });

  it('rejects segments out of order', () => {
    expect(segmentsReconstructWord('ab', [{ text: 'b' }, { text: 'a' }])).toBe(false);
  });

  it('rejects when a segment is missing text', () => {
    expect(segmentsReconstructWord('ab', [{ text: 'a' }, {}])).toBe(false);
  });

  it('rejects empty or undefined inputs', () => {
    expect(segmentsReconstructWord(undefined, [{ text: 'a' }])).toBe(false);
    expect(segmentsReconstructWord('a', undefined)).toBe(false);
    expect(segmentsReconstructWord('a', [])).toBe(false);
  });

  it('accepts a single whole-word root segment', () => {
    expect(segmentsReconstructWord('λόγος', [{ text: 'λόγος' }])).toBe(true);
  });
});
