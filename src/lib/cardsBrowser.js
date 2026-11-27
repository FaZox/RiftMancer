import { tx } from './i18n.js';
import { compileQuery } from './cardQuery.js';
import { compareCollector } from './catalogOrder.js';
import { zoneForCard } from './deckRules.js';

/**
 * « Cartes » tab (ONGLET-CARTES 1.3, 1.5): the whole catalog filtered by the
 * line of text, grouped by card, sorted, with what you own. Pure (no React):
 * tests/cardsBrowser.test.mjs. The hook is src/hooks/useCardsBrowser.js.
 */

export const CARD_SORTS = [
  { value: 'collector', label: tx('Extension et numéro') },
  { value: 'name', label: tx('Nom') },
  { value: 'rarity', label: tx('Rareté') },
  { value: 'energy', label: tx('Énergie') },
  { value: 'price', label: tx('Prix : le plus cher d’abord') },
  { value: 'priceAsc', label: tx('Prix : le moins cher d’abord') },
  { value: 'quantity', label: tx('Quantité') },
];
const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, showcase: 4 };

/** Copies owned per card, computed once: Map(cardId → { total, fr, en, foil }). */
export function ownedMap(stacks) {
  const m = new Map();
  for (const s of stacks) {
    const id = s.cardData?.id;
    if (!id) continue;
    let o = m.get(id);
    if (!o) { o = { total: 0, fr: 0, en: 0, foil: 0 }; m.set(id, o); }
    o.total += s.quantity;
    if (s.language === 'French') o.fr += s.quantity; else if (!s.language || s.language === 'English') o.en += s.quantity;
    if (s.foil) o.foil += s.quantity;
  }
  return m;
}

/** Cards of every deck (main, side, runes, battlefields, legend). */
export function deckCardIds(decks) {
  const ids = new Set();
  for (const d of decks || []) {
    if (d.legendId) ids.add(d.legendId);
    if (d.championId) ids.add(d.championId);
    for (const s of d.cards || []) ids.add(s.cardId);
  }
  return ids;
}

/**
 * The printings of one card share a key: the oracle link when the catalog has
 * it, otherwise the set and the number without its letter / star
 * (OGN-089, OGN-089a and OGN-089* together). Promos without a link stay alone.
 */
export function groupKey(card) {
  if (card.oracle) return `o:${card.oracle}`;
  const m = /^[A-Z0-9]+-(\d+)[a-z*]*\/\d+$/i.exec(card.code || '');
  return m ? `n:${card.set}-${parseInt(m[1], 10)}` : `i:${card.id}`;
}

/** Comparator of the tiles. `nameOf(card)`, `priceOf(card)` (null = no price), `ownedOf(group)`. */
export function cardComparator(sort, { nameOf, priceOf, ownedOf }) {
  const byNum = (a, b) => compareCollector(a.card, b.card);
  switch (sort) {
    case 'name':
      return (a, b) => {
        const nameA = nameOf(a.card) || '';
        const nameB = nameOf(b.card) || '';
        return nameA.localeCompare(nameB, 'fr') || byNum(a, b);
      };
    case 'rarity': return (a, b) => (RARITY_RANK[b.card.rarity] ?? -1) - (RARITY_RANK[a.card.rarity] ?? -1) || byNum(a, b);
    case 'energy':
      return (a, b) => {
        const energyDiff = (a.card.energy ?? 99) - (b.card.energy ?? 99);
        if (energyDiff !== 0) return energyDiff;
        const nameA = nameOf(a.card) || '';
        const nameB = nameOf(b.card) || '';
        return nameA.localeCompare(nameB, 'fr');
      };
    case 'quantity': return (a, b) => ownedOf(b) - ownedOf(a) || byNum(a, b);
    case 'price': case 'priceAsc': {
      const dir = sort === 'priceAsc' ? 1 : -1;
      return (a, b) => {
        const pa = priceOf(a.card); const pb = priceOf(b.card);
        if (pa == null || pb == null) return (pa == null) - (pb == null) || byNum(a, b);
        return dir * (pa - pb) || byNum(a, b);
      };
    }
    default: return byNum;
  }
}

/**
 * Filter, group and sort. `cards`: every printing; `parsed`: parseQuery();
 * `owned`: ownedMap(); `ownership`: 'all' | 'owned' | 'missing';
 * `ctx`: compileQuery's context (extra, banned, inDeck, foil);
 * `nameOf`, `priceOf`: for the sorts.
 * → { items: [{ card, prints: [card…], owned }], counts: { all, owned, missing } }
 * (counts: before the ownership choice, for its three buttons).
 */
export function browseCards(cards, { parsed, owned, ownership = 'all', sort = 'collector', grouped = true, ctx = {}, nameOf = (c) => c.name || '', priceOf = () => null }) {
  const ownedOf = (c) => owned.get(c.id)?.total || 0;
  const match = compileQuery(parsed, { ...ctx, owned: ownedOf });
  const groups = new Map();
  const items = [];
  for (const c of cards) {
    if (!match(c)) continue;
    if (!grouped) { items.push({ card: c, prints: [c], owned: ownedOf(c) }); continue; }
    const k = groupKey(c);
    const g = groups.get(k);
    if (g) { g.prints.push(c); g.owned += ownedOf(c); } else { const n = { card: c, prints: [c], owned: ownedOf(c) }; groups.set(k, n); items.push(n); }
  }
  if (grouped) {
    // The tile shows the normal printing (the first in number order)
    for (const g of items) if (g.prints.length > 1) { g.prints.sort(compareCollector); g.card = g.prints[0]; }
  }
  let nOwned = 0;
  for (const g of items) if (g.owned > 0) nOwned++;
  const counts = { all: items.length, owned: nOwned, missing: items.length - nOwned };
  const shown = ownership === 'all' ? items : items.filter(g => (ownership === 'owned' ? g.owned > 0 : g.owned === 0));
  shown.sort(cardComparator(sort, { nameOf, priceOf, ownedOf: (g) => g.owned }));
  return { items: shown, counts };
}

/**
 * Rows of the virtual grid: a set title before each set when sorted by set and
 * number, then the tiles by `cols`. → [{ type: 'set', set, setName, owned, total } | { type: 'cards', items }]
 */
export function gridRows(items, cols, withSets) {
  const rows = [];
  const push = (list) => { for (let i = 0; i < list.length; i += cols) rows.push({ type: 'cards', items: list.slice(i, i + cols) }); };
  if (!withSets) { push(items); return rows; }
  let cur = null; let list = [];
  const flush = () => {
    if (!cur) return;
    rows.push({ type: 'set', set: cur.set, setName: cur.setName, owned: list.filter(g => g.owned > 0).length, total: list.length });
    push(list);
  };
  for (const g of items) {
    if (!cur || g.card.set !== cur.set) { flush(); cur = g.card; list = []; }
    list.push(g);
  }
  flush();
  return rows;
}

/** Copies owned / cards per set of the catalog (progress of the set filter). */
export function setProgress(cards, owned) {
  const m = new Map();
  for (const c of cards) {
    let s = m.get(c.set);
    if (!s) { s = { set: c.set, setName: c.setName || c.set, own: 0, total: 0 }; m.set(c.set, s); }
    s.total++;
    if (owned.get(c.id)?.total) s.own++;
  }
  return m;
}

/** A deck with `cards` added (one copy each; a legend becomes the deck's legend). */
export function deckWithCards(deck, cards) {
  let slots = [...(deck.cards || [])];
  let legendId = deck.legendId || null;
  for (const c of cards) {
    if (c.type === 'legend') { legendId = c.id; continue; }
    const zone = zoneForCard(c);
    const cur = slots.find(s => s.cardId === c.id && s.zone === zone);
    slots = slots.filter(s => s !== cur);
    slots.push({ cardId: c.id, zone, quantity: (cur?.quantity || 0) + 1 });
  }
  return { ...deck, cards: slots, legendId };
}

/** CSV of the view (« Exporter la vue »). */
export function viewCsv(items, { nameOf, priceOf }) {
  const q = (v) => { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [['Set', 'Number', 'Name', 'Type', 'Rarity', 'Energy', 'Might', 'Owned', 'Price'].join(',')];
  for (const g of items) {
    const c = g.card;
    const p = priceOf(c);
    lines.push([c.set, c.collectorNumber, nameOf(c), c.type, c.rarity, c.energy, c.might, g.owned, p == null ? '' : p.toFixed(2)].map(q).join(','));
  }
  return lines.join('\n') + '\n';
}
