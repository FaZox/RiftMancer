import { tx } from './i18n.js';

/** Printings of one card (« Impressions et variantes », PrintsList.jsx): pure helpers, tested in tests/rifthunt.test.mjs. */
export const VARIANT_LABEL = {
  base: tx('Normale'),
  alternate: tx('Illustration alternative'),
  overnumbered: tx('Overnumbered'),
  signature: tx('Signature'),
  showcase: tx('Showcase'),
  promo: tx('Promo'),
};
const ORDER = ['base', 'alternate', 'overnumbered', 'signature', 'showcase', 'promo'];

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const fullName = (c) => fold(c.nameEn || c.name);
const sameStats = (a, b) => a.type === b.type && (a.energy ?? null) === (b.energy ?? null) && (a.might ?? null) === (b.might ?? null);

/**
 * The printings of a card, the normal one first (the card alone when it has no link). Linked by the oracle id;
 * a promo that carries no oracle yet is linked to the normal card by its full name and its stats
 * (type, energy, might), so promos always show next to the original.
 */
export function printsOf(card, cards) {
  if (!card) return [];
  const ids = new Set([card.id]);
  if (card.oracle) for (const c of cards) if (c.oracle === card.oracle) ids.add(c.id);
  const n = fullName(card);
  if (n) {
    for (const c of cards) {
      if (ids.has(c.id) || (c.oracle && card.oracle) || fullName(c) !== n || !sameStats(c, card)) continue;
      if (c.variant === 'promo' || card.variant === 'promo' || (!c.oracle && !card.oracle && c.set === card.set)) ids.add(c.id);
    }
  }
  if (ids.size === 1) return [card];
  const rank = (c) => { const i = ORDER.indexOf(c.variant || 'base'); return i < 0 ? ORDER.length : i; };
  return cards.filter(c => ids.has(c.id))
    .sort((a, b) => rank(a) - rank(b) || String(a.set).localeCompare(String(b.set)) || (a.number ?? 0) - (b.number ?? 0) || a.id.localeCompare(b.id));
}

/** « Promo · Metal », « Signature » */
export const printKindLabel = (c) => [VARIANT_LABEL[c.variant || 'base'] || VARIANT_LABEL.base, c.printLabel].filter(Boolean).join(' · ');

/**
 * New printings (promos, variants) get the French name and text of another
 * printing of the same card at once (oracle link), without waiting for the next
 * translations update. `links`: [{ id, oracle }] written in the same install
 * (the catalog's cards do not carry their oracle yet). Returns the new cards.
 */
export function frenchFromPrints(newCards, catalog, links = []) {
  const oracleOf = new Map(links.filter(l => l.oracle).map(l => [l.id, l.oracle]));
  const source = new Map();
  for (const c of catalog) {
    const o = c.oracle || oracleOf.get(c.id);
    if (!o || !c.nameFr) continue;
    const prev = source.get(o);
    // the normal printing first, then one with a text
    if (!prev || ((c.variant || 'base') === 'base' && (prev.variant || 'base') !== 'base') || (!prev.textFr && c.textFr)) source.set(o, c);
  }
  return newCards.map(c => {
    const s = c.oracle && !c.nameFr ? source.get(c.oracle) : null;
    if (!s) return c;
    return { ...c, nameFr: s.nameFr, ...(s.textFr && !c.textFr ? { textFr: s.textFr } : {}) };
  });
}
