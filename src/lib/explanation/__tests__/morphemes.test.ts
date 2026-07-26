import { describe, it, expect } from 'vitest';
import { segmentsReconstructWord } from '../morphemes';

describe('segmentsReconstructWord', () => {
  it('accepts segments that concatenate to the exact word', () => {
    expect(
      segmentsReconstructWord('הִתְהַלֵּךְ', [{ text: 'הִתְ' }, { text: 'הַלֵּךְ' }])
    ).toBe(true);
  });

  it('rejects segments that drop or alter characters', () => {
    expect(segmentsReconstructWord('הִתְהַלֵּךְ', [{ text: 'הִתְ' }, { text: 'הלך' }])).toBe(false);
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
