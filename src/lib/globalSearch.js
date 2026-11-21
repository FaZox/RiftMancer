import { tx } from './i18n.js';
/**
 * Global search (lot 6 e, B.6.11): one search for cards, decks, boxes,
 * people and settings. Pure (tests/globalSearch.test.mjs); the palette is
 * SearchPalette.jsx. Accents and case ignored; a card matches by its French
 * or English name, full name or printed code (« OGN-030 »).
 */
export const GROUP_LABEL = { cards: tx('Cartes'), decks: tx('Decks'), boxes: tx('Boîtes'), people: tx('Personnes'), settings: tx('Réglages') };
const MAX = 8;

export const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").trim();

/** Score of `text` for the query words (0 = no match; start of a word ranks higher). */
function score(text, words) {
  const t = fold(text);
  if (!t) return 0;
  let s = 0;
  for (const w of words) {
    const i = t.indexOf(w);
    if (i < 0) return 0;
    s += i === 0 ? 3 : /[\s,'-]/.test(t[i - 1]) ? 2 : 1;
  }
  return s;
}
const best = (texts, words) => Math.max(0, ...texts.map(t => score(t, words)));

/**
 * `data`: { cards: catalog cards, owned: Map(cardId → copies), decks, boxes,
 * people: records ({ id, name }), settings: [{ id, label }] }.
 * `allCards`: also the cards you do not own (« Chercher dans toutes les cartes »).
 * Returns [{ group, label, items: [{ type, id, label, detail, cardId? }] }], groups without result left out.
 */
export function searchAll(query, data, { allCards = false } = {}) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  // Cards: one line per card name (prints grouped), owned first
  const byName = new Map();
  for (const c of data.cards || []) {
    const owned = data.owned?.get(c.id) || 0;
    if (!allCards && !owned) continue;
    const s = best([c.nameFr, c.name, c.nameEn, c.code], words);
    if (!s) continue;
    const key = fold(c.nameFr || c.nameEn || c.name);
    const prev = byName.get(key);
    if (!prev) byName.set(key, { c, owned, s });
    else { if (owned && !prev.owned) prev.c = c; prev.owned += owned; prev.s = Math.max(prev.s, s); }
  }
  const cards = [...byName.values()]
    .sort((a, b) => (b.owned > 0) - (a.owned > 0) || b.s - a.s || fold(a.c.nameFr || a.c.name).localeCompare(fold(b.c.nameFr || b.c.name)))
    .slice(0, MAX)
    .map(({ c, owned }) => ({ type: 'card', id: c.id, cardId: c.id, label: c.nameFr || c.nameEn || c.name, detail: owned ? tx('×{owned} possédée{v1}', { owned, v1: owned > 1 ? 's' : '' }) : tx('non possédée') }));
  if (cards.length) out.push({ group: 'cards', label: GROUP_LABEL.cards, items: cards });
  const records = (list, type, group, detail) => {
    const items = (list || []).filter(r => !r.deleted && score(r.name, words)).sort((a, b) => score(b.name, words) - score(a.name, words)).slice(0, MAX)
      .map(r => ({ type, id: r.id, label: r.name, detail: detail?.(r) || null }));
    if (items.length) out.push({ group, label: GROUP_LABEL[group], items });
  };
  records(data.decks, 'deck', 'decks', (d) => `${(d.cards || []).reduce((n, s) => n + (s.quantity || 0), 0)} cartes`);
  records(data.boxes, 'box', 'boxes');
  records(data.people, 'person', 'people');
  const settings = (data.settings || []).filter(s => score(s.label, words) || score(s.keywords, words)).slice(0, MAX)
    .map(s => ({ type: 'setting', id: s.id, label: s.label, detail: tx('Réglages') }));
  if (settings.length) out.push({ group: 'settings', label: GROUP_LABEL.settings, items: settings });
  return out;
}

/** Last searches (5), most recent first. */
const RECENT_KEY = 'rb.recentSearches';
export function recentSearches(storage = globalThis.localStorage) {
  try { const a = JSON.parse(storage?.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.slice(0, 5) : []; } catch { return []; }
}
export function rememberSearch(query, storage = globalThis.localStorage) {
  const q = String(query || '').trim();
  if (q.length < 2) return recentSearches(storage);
  const list = [q, ...recentSearches(storage).filter(x => fold(x) !== fold(q))].slice(0, 5);
  try { storage?.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

/** Keywords of the settings sections, so « QR », « sauvegarde » or « texte » find them. */
export const SETTINGS_KEYWORDS = {
  sync: tx('appairer QR code téléphone PC synchroniser'),
  backup: tx('sauvegarde restaurer dossier clé USB'),
  content: 'nouvelles cartes traductions bannies pack',
  scan: tx('IA moteur apprentissage état langue foil vitesse'),
  price: 'prix tendance Cardmarket',
  display: tx('français animations taille texte'),
  game: 'format points compteur main',
  help: tx('rapport démonstration présentation aide'),
  about: tx('version nouveautés licences'),
};
