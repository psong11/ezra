/**
 * Formats a (possibly partial) word explanation for HTML display.
 * Runs on the client against the accumulating stream, so it must be
 * cheap, dependency-free, and tolerant of incomplete markdown.
 *
 * Lines that are entirely bold ("**Grammar**") become section headers;
 * everything else becomes paragraphs with inline bold/italic preserved.
 * Escapes HTML first so model output can't inject markup.
 */
export function formatExplanation(text: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return text
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // A line that is entirely bold ("**Grammar**") is a section header
      const header = line.match(/^\*\*([^*]+)\*\*:?$/);
      if (header) {
        return `<h4>${escapeHtml(header[1])}</h4>`;
      }
      const inline = escapeHtml(line)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]/g, '<span class="ref">[$1]</span>');
      return `<p>${inline}</p>`;
    })
    .join('');
}
