import { describe, it, expect } from 'vitest';
import { explanationCacheKey } from '../cache';

describe('explanationCacheKey', () => {
  it('is deterministic', () => {
    const a = explanationCacheKey('אֱלֹהִים', 'Hebrew', 'בְּרֵאשִׁית בָּרָא אֱלֹהִים');
    const b = explanationCacheKey('אֱלֹהִים', 'Hebrew', 'בְּרֵאשִׁית בָּרָא אֱלֹהִים');
    expect(a).toBe(b);
  });

  it('produces a filesystem/URL-safe hex key', () => {
    const key = explanationCacheKey('λόγος', 'Greek', 'Ἐν ἀρχῇ ἦν ὁ λόγος');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs across words, languages, and verse contexts', () => {
    const base = explanationCacheKey('λόγος', 'Greek', 'Ἐν ἀρχῇ ἦν ὁ λόγος');
    expect(explanationCacheKey('θεός', 'Greek', 'Ἐν ἀρχῇ ἦν ὁ λόγος')).not.toBe(base);
    expect(explanationCacheKey('λόγος', 'Hebrew', 'Ἐν ἀρχῇ ἦν ὁ λόγος')).not.toBe(base);
    expect(explanationCacheKey('λόγος', 'Greek', 'other verse')).not.toBe(base);
  });

  it('normalizes unicode so composed/decomposed forms share a key', () => {
    // é as a single codepoint vs e + combining acute
    const composed = explanationCacheKey('é', 'Greek', 'verse');
    const decomposed = explanationCacheKey('é', 'Greek', 'verse');
    expect(composed).toBe(decomposed);
  });
});
