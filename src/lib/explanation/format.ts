/**
 * Renders a model-written snippet as safe HTML: escapes everything first
 * (model output must never inject markup), then converts **bold** markers —
 * used to highlight the target word inside occurrence snippets — to <strong>.
 * Tolerant of partial (mid-stream) text: an unterminated ** stays literal.
 */
export function formatSnippet(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
