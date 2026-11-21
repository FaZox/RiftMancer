/**
 * Strict allow-list sanitizer for card rules text.
 *
 * The English text comes from the official gallery (scraped) and the catalog
 * can be pushed from the PC to the phone, so it is never trusted: only plain
 * formatting tags survive, WITHOUT any attribute (no style, no on…=, no href).
 * Every other tag is removed (its text stays); stray < and > are escaped.
 */
const ALLOWED = new Set(['b', 'i', 'em', 'strong', 'br', 'p', 'span', 'u', 'ul', 'ol', 'li']);

export function sanitizeHtml(html) {
  if (typeof html !== 'string' || !html) return '';
  return html.split(/(<[^>]*>)/g).map(part => {
    if (part.startsWith('<') && part.endsWith('>')) {
      const m = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b/.exec(part);
      if (!m) return '';
      const name = m[2].toLowerCase();
      if (!ALLOWED.has(name)) return '';
      if (name === 'br') return '<br>';
      return `<${m[1]}${name}>`;
    }
    return part.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }).join('');
}
