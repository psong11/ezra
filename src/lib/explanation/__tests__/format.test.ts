import { describe, it, expect } from 'vitest';
import { formatExplanation } from '../format';

describe('formatExplanation', () => {
  it('turns all-bold lines into section headers', () => {
    expect(formatExplanation('**Grammar**')).toBe('<h4>Grammar</h4>');
    expect(formatExplanation('**Grammar**:')).toBe('<h4>Grammar</h4>');
  });

  it('wraps regular lines in paragraphs with inline formatting', () => {
    expect(formatExplanation('Root: **bara** means *to create*')).toBe(
      '<p>Root: <strong>bara</strong> means <em>to create</em></p>'
    );
  });

  it('styles bracketed verse references', () => {
    expect(formatExplanation('See [Genesis 1:1]')).toBe(
      '<p>See <span class="ref">[Genesis 1:1]</span></p>'
    );
  });

  it('escapes HTML from model output', () => {
    const html = formatExplanation('<script>alert(1)</script> & <img>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('drops blank lines and handles multi-section text', () => {
    const html = formatExplanation('**Word**\nElohim\n\n**Grammar**\nNoun');
    expect(html).toBe('<h4>Word</h4><p>Elohim</p><h4>Grammar</h4><p>Noun</p>');
  });

  it('tolerates partial (mid-stream) markdown without throwing', () => {
    // An unterminated bold marker mid-stream must not crash or emit tags
    const html = formatExplanation('**Gram');
    expect(html).toBe('<p>**Gram</p>');
  });
});
