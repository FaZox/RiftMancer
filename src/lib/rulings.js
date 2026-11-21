/**
 * Rulings (card sheet): the questions and answers of Riftbound FAQ
 * (riftboundfaq.com, by Christian « Near » Ivicevic, CC BY-SA 4.0 according to
 * rifthunt; unofficial, English only), through rifthunt's file /bulk/rulings.
 * Installed on the PC as a content layer (electron/content.cjs, kind
 * « rulings »), written into the served catalog (`rulings`): the phone gets
 * them with the catalog at the sync. Pure functions, tests/rulings.test.mjs.
 */
import { PageReadError } from './banUpdate.js';
import { printingIds } from './rifthunt.js';
import { tx } from './i18n.js';

export const RULINGS_URL = 'https://api.rifthunt.com/bulk/rulings';
export const FAQ_SITE = 'https://www.riftboundfaq.com/';
export const RULINGS_SOURCE = { label: 'Riftbound FAQ (riftboundfaq.com)', url: FAQ_SITE };
const UNREADABLE = tx('Les rulings n’ont pas pu être lus.');
const LINK = /^https:\/\/(www\.riftboundfaq\.com|rifthunt\.com|playriftbound\.com)\/[\w\-./#%?=&]*$/;
const KEEP = new Set(['p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br', 'sup', 'a', 'code']);
const AS_P = new Set(['div', 'h4', 'h5', 'h6', 'blockquote']); // shown as paragraphs

/**
 * The answers' HTML with only plain tags and links to riftboundfaq.com,
 * rifthunt.com or playriftbound.com (relative links: rifthunt's card pages).
 * Every other attribute, tag or address goes; stray < and > are escaped.
 */
export function sanitizeRulingHtml(html) {
  if (typeof html !== 'string' || !html) return '';
  return html.split(/(<\/?[a-zA-Z][^>]*>)/g).map(part => {
    if (!(part.startsWith('<') && part.endsWith('>'))) return part.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const m = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b/.exec(part);
    if (!m) return '';
    let name = m[2].toLowerCase();
    if (AS_P.has(name)) name = 'p';
    if (!KEEP.has(name)) return '';
    if (name === 'br') return '<br>';
    if (name === 'a' && !m[1]) {
      let href = /\shref\s*=\s*"([^"]*)"/i.exec(part)?.[1] || '';
      if (href.startsWith('/')) href = `https://rifthunt.com${href}`;
      return LINK.test(href) ? `<a href="${href}" target="_blank" rel="noopener noreferrer">` : '<a>';
    }
    return `<${m[1]}${name}>`;
  }).join('');
}

/** rifthunt's file (throws when it is not that file). */
export function parseRulings(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new PageReadError(UNREADABLE); }
  if (!Array.isArray(data?.cards) || !data.cards.length || !data.cards.every(c => typeof c?.card === 'string' && Array.isArray(c.rulings))) throw new PageReadError(UNREADABLE);
  return data;
}

const letters = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const withoutLabel = (s) => String(s || '').replace(/\s*\([^)]*\)\s*$/, '');

/** Names a catalog card may be called by in the FAQ (« Lux, Crownguard », « Hard Bargain »). */
function namesOf(c) {
  const out = [c.nameEn, c.name];
  if (c.type === 'legend' && c.tags?.[0]) out.push(`${c.tags[0]} ${c.name}`);
  return out.filter(Boolean).map(n => letters(withoutLabel(n)));
}

/**
 * The layer's data: { source, license, licenseUrl, updatedAt, cards: [{ name, url,
 * authors, ids, rulings: [{ id, question, html }] }] } and the FAQ names with no
 * card in the catalog (`unknown`). Cards are found through rifthunt's printings
 * when given (name → riftboundId), else by name; all printings of a found card
 * follow (oracle link).
 */
export function buildRulings(bulk, catalog, printings = null) {
  const byKey = new Map();
  const add = (key, id) => { if (!byKey.has(key)) byKey.set(key, new Set()); byKey.get(key).add(id); };
  const known = new Set(catalog.map(c => c.id));
  if (printings) {
    const ids = printingIds(printings);
    for (const p of printings) if (known.has(ids.get(p))) add(letters(withoutLabel(p.name)), ids.get(p));
  }
  for (const c of catalog) for (const k of namesOf(c)) add(k, c.id);
  const byOracle = new Map();
  for (const c of catalog) if (c.oracle) { if (!byOracle.has(c.oracle)) byOracle.set(c.oracle, []); byOracle.get(c.oracle).push(c.id); }
  const oracleOf = new Map(catalog.map(c => [c.id, c.oracle]));
  const cards = [], unknown = [];
  for (const e of bulk.cards) {
    const found = new Set(byKey.get(letters(e.card)) || []);
    for (const id of [...found]) for (const other of byOracle.get(oracleOf.get(id)) || []) found.add(other);
    if (!found.size) unknown.push(e.card);
    const rulings = e.rulings
      .filter(r => typeof r?.question === 'string' && typeof r.html === 'string')
      .map(r => ({ id: String(r.id || '').slice(0, 100), question: r.question.trim().slice(0, 500), html: sanitizeRulingHtml(r.html).slice(0, 20000) }))
      .filter(r => r.question && r.html);
    if (!rulings.length) continue;
    cards.push({
      name: String(e.card).slice(0, 200),
      url: LINK.test(e.url || '') ? e.url : FAQ_SITE,
      authors: (e.authors || []).map(a => String(a?.name || '')).filter(Boolean).slice(0, 5),
      ids: [...found].sort(),
      rulings,
    });
  }
  return {
    data: {
      source: RULINGS_SOURCE,
      license: String(bulk.license || 'CC BY-SA 4.0').slice(0, 40),
      licenseUrl: LINK.test(bulk.licenseUrl || '') || /^https:\/\/creativecommons\.org\/[\w\-./]*$/.test(bulk.licenseUrl || '') ? bulk.licenseUrl : 'https://creativecommons.org/licenses/by-sa/4.0/',
      updatedAt: /^\d{4}-\d{2}-\d{2}/.test(bulk.committedAt || '') ? bulk.committedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
      cards,
    },
    unknown,
  };
}

/** The content layer (kind « rulings »). */
export function rulingsLayer(data, now = new Date()) {
  return { createdAt: now.toISOString(), source: { label: 'rifthunt.com', url: 'https://rifthunt.com/' }, count: data.cards.reduce((n, c) => n + c.rulings.length, 0), data };
}

/** The FAQ entry of a card, or of another printing of it (oracle link); null when none. */
export function rulingsFor(card, data, catalog = []) {
  if (!card || !data?.cards?.length) return null;
  const direct = data.cards.find(e => e.ids?.includes(card.id));
  if (direct || !card.oracle) return direct || null;
  const prints = new Set(catalog.filter(c => c.oracle === card.oracle).map(c => c.id));
  return data.cards.find(e => e.ids?.some(id => prints.has(id))) || null;
}
