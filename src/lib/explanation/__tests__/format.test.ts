import { describe, it, expect } from 'vitest';
import { formatSnippet } from '../format';

describe('formatSnippet', () => {
  it('converts **bold** target markers to <strong>', () => {
    expect(formatSnippet('בְּרֵאשִׁית בָּרָא **אֱלֹהִים**')).toBe(
      'בְּרֵאשִׁית בָּרָא <strong>אֱלֹהִים</strong>'
    );
  });

  it('escapes HTML from model output before formatting', () => {
    const html = formatSnippet('<script>alert(1)</script> & **God**');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('<strong>God</strong>');
  });

  it('leaves unterminated bold markers literal (mid-stream tolerance)', () => {
    expect(formatSnippet('and **Go')).toBe('and **Go');
  });

  it('handles multiple bold spans', () => {
    expect(formatSnippet('**a** and **b**')).toBe('<strong>a</strong> and <strong>b</strong>');
  });
});
