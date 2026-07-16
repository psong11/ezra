import { describe, it, expect } from 'vitest';
import { resolveReference } from '../refs';

describe('resolveReference', () => {
  it('resolves exact English book names', () => {
    expect(resolveReference('Genesis', 1, 1)).toEqual({
      bookId: 'genesis',
      chapter: 1,
      verse: 1,
      label: 'Genesis 1:1',
    });
  });

  it('resolves numbered books', () => {
    expect(resolveReference('1 Samuel', 3, 10)?.bookId).toBe('1-samuel');
    expect(resolveReference('2 Corinthians', 5)?.bookId).toBe('2-corinthians');
  });

  it('resolves aliases and abbreviations', () => {
    expect(resolveReference('Psalm', 82, 1)?.bookId).toBe('psalms');
    expect(resolveReference('Song of Solomon', 2)?.bookId).toBe('song-of-songs');
    expect(resolveReference('Gen', 12, 1)?.bookId).toBe('genesis');
    expect(resolveReference('gen.', 12, 1)?.bookId).toBe('genesis');
  });

  it('rejects unknown books (hallucination guard)', () => {
    expect(resolveReference('Book of Enoch', 1, 1)).toBeNull();
    expect(resolveReference('Genesis II', 1, 1)).toBeNull();
  });

  it('rejects out-of-range chapters', () => {
    expect(resolveReference('Genesis', 51, 1)).toBeNull(); // Genesis has 50
    expect(resolveReference('Jude', 2, 1)).toBeNull(); // Jude has 1
    expect(resolveReference('Genesis', 0, 1)).toBeNull();
  });

  it('tolerates missing or invalid verses (chapter-only links)', () => {
    expect(resolveReference('Exodus', 20)).toEqual({
      bookId: 'exodus',
      chapter: 20,
      verse: undefined,
      label: 'Exodus 20',
    });
    expect(resolveReference('Exodus', 20, 0)?.verse).toBeUndefined();
  });

  it('handles undefined inputs from partial streams', () => {
    expect(resolveReference(undefined, 1)).toBeNull();
    expect(resolveReference('Genesis', undefined)).toBeNull();
  });
});
