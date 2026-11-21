/**
 * Deck share code: a short text (« RB1.… ») to paste in a message, imported by
 * « Importer une liste » (deckList.parseDeckList recognises it).
 *
 * Content: legend, champion and every zone with card ids and quantities,
 * as compact text then base64url. Version prefix for future changes.
 *   L=<legend>;C=<champion>;M=<id>*<n>,…;R=…;B=…;S=…;N=<name>
 *
 * Since lot 7.1 the app shares the community format (deckCodes.js, Piltover
 * Archive's deck codes); « RB1. » codes are still read.
 */

const PREFIX = 'RB1.';
const ZONES = { main: 'M', rune: 'R', battlefield: 'B', side: 'S' };
const FROM = Object.fromEntries(Object.entries(ZONES).map(([k, v]) => [v, k]));

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

export function encodeDeck(deck) {
  const parts = [];
  if (deck.legendId) parts.push(`L=${deck.legendId}`);
  if (deck.championId) parts.push(`C=${deck.championId}`);
  for (const [zone, letter] of Object.entries(ZONES)) {
    const list = (deck.cards || []).filter(s => s.zone === zone && s.quantity > 0).map(s => `${s.cardId}*${s.quantity}`);
    if (list.length) parts.push(`${letter}=${list.join(',')}`);
  }
  if (deck.name) parts.push(`N=${encodeURIComponent(deck.name)}`);
  return PREFIX + toBase64Url(parts.join(';'));
}

export function isDeckCode(text) {
  return /^\s*RB1\.[A-Za-z0-9_-]+\s*$/.test(String(text || ''));
}

/**
 * @param {string} code
 * @param {(id: string) => boolean} [known]  card id exists in the catalog
 * @returns {{ deck: { name?, legendId, championId, cards }, unknown: string[] } | null}
 */
export function decodeDeck(code, known = () => true) {
  if (!isDeckCode(code)) return null;
  let text;
  try {
    text = fromBase64Url(String(code).trim().slice(PREFIX.length));
  } catch {
    return null;
  }
  const deck = { legendId: null, championId: null, cards: [] };
  const unknown = [];
  const ok = (id) => /^[a-z0-9*-]{3,40}$/i.test(id) && known(id);
  for (const part of text.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const key = part.slice(0, i);
    const val = part.slice(i + 1);
    if (key === 'L') { if (ok(val)) deck.legendId = val; else unknown.push(val); }
    else if (key === 'C') { if (ok(val)) deck.championId = val; else unknown.push(val); }
    else if (key === 'N') { try { deck.name = decodeURIComponent(val).slice(0, 80); } catch { /* ignore */ } }
    else if (FROM[key]) {
      for (const item of val.split(',')) {
        const m = /^(.+)\*(\d{1,2})$/.exec(item);
        if (!m) continue;
        if (!ok(m[1])) { unknown.push(m[1]); continue; }
        deck.cards.push({ cardId: m[1], zone: FROM[key], quantity: Number(m[2]) });
      }
    }
  }
  return { deck, unknown };
}
