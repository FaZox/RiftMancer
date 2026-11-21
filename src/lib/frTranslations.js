/**
 * « Mettre à jour les traductions françaises » (lot 4.3 of AMELIORATIONS-APPLI.md).
 * The French names and rules texts are the community's work on riftboundfr.fr
 * (thanks to them), in two files:
 *   repertoire-cartes.json  { c: [{ i: uuid, b: slug « ogn-001-298 », n: name, … }] }
 *   textes-cartes.json      { t: { <uuid>: { fr: text } } }
 * Same join as the former scraper (model/cards_scraper.py load_french_data,
 * scripts/enrich-catalog.mjs): slug → card id (« ogn-299*-298 » →
 * « ogn-299-star-298 »), print suffix dropped, prints without French data take
 * those of another print of the same card. Texts go through sanitizeHtml.
 * Pure functions, tested in tests/frTranslations.test.mjs.
 */
import { sanitizeHtml } from './sanitizeHtml.js';import { tx } from './i18n.js';


export const FR_URLS = ['https://riftboundfr.fr/repertoire-cartes.json', 'https://riftboundfr.fr/textes-cartes.json'];
export const FR_SOURCE = { label: 'riftboundfr.fr', url: 'https://riftboundfr.fr/' };

const PRINT = /\s*\((Alternate Art|Overnumbered|Signature)[^)]*\)\s*$/;
const NOT_FR = tx('Ce fichier ne vient pas de riftboundfr.fr (format inattendu).');
const MAX = 4000;

/** Which file is this text? 'repertoire' | 'textes' (throws for anything else). */
export function readFrFile(text) {
  let j;
  try { j = JSON.parse(text); } catch { throw new Error(NOT_FR); }
  if (j && Array.isArray(j.c) && j.c.every(e => e && typeof e === 'object')) return { kind: 'repertoire', data: j };
  if (j && j.t && typeof j.t === 'object' && !Array.isArray(j.t)) return { kind: 'textes', data: j };
  throw new Error(NOT_FR);
}

const cardId = (slug) => String(slug).replace(/-(\w+)\*-/, '-$1-star-');
const plain = (s) => String(s).replace(/<[^>]*>/g, '').replace(PRINT, '').replace(/\s+/g, ' ').trim();

/**
 * French names and texts for the catalog's cards. Returns { names, texts,
 * unknown } — `unknown`: site entries without a card in the catalog (promos
 * not listed, cards of a set not installed yet), ignored and counted.
 */
export function buildTranslations(repertoire, textes, cards) {
  const ids = new Set(cards.map(c => c.id));
  const names = {}, texts = {};
  let unknown = 0;
  for (const e of repertoire?.c || []) {
    if (!e?.b || typeof e.n !== 'string') continue;
    const id = cardId(e.b);
    if (!ids.has(id)) { unknown++; continue; }
    const name = plain(e.n).slice(0, 200);
    if (name) names[id] = name;
    const t = textes?.t?.[e.i]?.fr;
    if (typeof t === 'string' && t.trim()) texts[id] = sanitizeHtml(t.trim()).slice(0, MAX);
  }
  // Prints without French data (or an English fallback name) take another print's.
  const key = (c) => `${c.type}|${c.nameEn || c.name}`;
  const english = (c, n) => !n || n === c.name || (c.nameEn && n.replace(/, /g, ' - ') === c.nameEn);
  const byCard = new Map();
  for (const c of cards) {
    const n = names[c.id];
    if (english(c, n)) continue;
    const k = key(c);
    if (!byCard.has(k) || (!texts[byCard.get(k)] && texts[c.id])) byCard.set(k, c.id);
  }
  for (const c of cards) {
    if (!english(c, names[c.id])) continue;
    const src = byCard.get(key(c));
    if (!src) continue;
    names[c.id] = names[src];
    if (!texts[c.id] && texts[src]) texts[c.id] = texts[src];
  }
  return { names, texts, unknown };
}

/** « 37 noms et 52 textes nouveaux ou modifiés » against the catalog in use. */
export function translationChanges(tr, cards) {
  const byId = new Map(cards.map(c => [c.id, c]));
  const names = Object.entries(tr.names).filter(([id, n]) => byId.get(id)?.nameFr !== n).map(([id]) => id);
  const texts = Object.entries(tr.texts).filter(([id, t]) => byId.get(id)?.textFr !== t).map(([id]) => id);
  return { names, texts, count: new Set([...names, ...texts]).size };
}

export function changesText({ names, texts }) {
  if (!names.length && !texts.length) return tx('Les traductions sont à jour.');
  const s = (n) => (n > 1 ? 's' : '');
  return tx('{length} nom{s} et {length2} texte{s2} nouveaux ou modifiés.', { length: names.length, s: s(names.length), length2: texts.length, s2: s(texts.length) });
}

/** The content layer (electron/content.cjs, kind « traductions »). */
export function translationLayer(tr, now = new Date()) {
  return { createdAt: now.toISOString(), source: FR_SOURCE, count: Object.keys(tr.names).length, data: { names: tr.names, texts: tr.texts } };
}
