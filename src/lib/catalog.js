/**
 * Card catalog helpers for the collection views (sets, progress, sorting).
 */
import { getMatcher } from './cardMatcher.js';import { tx } from './i18n.js';


// Display order of sets (release order); unknown sets go last, alphabetically.
const SET_ORDER = ['OGN', 'OGS', 'SFD', 'UNL', 'VEN', 'RAD'];

export function setRank(set) {
  const i = SET_ORDER.indexOf(set);
  return i === -1 ? SET_ORDER.length : i;
}

/**
 * "Base" card of a set = the numbered cards of the main list, e.g.
 * "OGN-089/298". Alternate arts (089a), signed/star (*), promos (R01, SP1/005)
 * and tokens (T01) are "variants".
 */
export function isBaseCard(card) {
  const m = /^[A-Z]+-(\d+)\/(\d+)$/.exec(card.code || '');
  return !!m && Number(m[1]) <= Number(m[2]);
}

/** Every card of the catalog, as UI cardData (cached per catalog load). */
let cache = { cards: null, list: null };
export function allCards() {
  const m = getMatcher();
  if (cache.cards !== m.cards) {
    cache = { cards: m.cards, list: m.cards.map(c => m.getCardData(c.id)).filter(Boolean) };
  }
  return cache.list;
}

/** Sets of the catalog: [{ set, setName, cards: [...], base: [...], variants: [...] }] */
export function catalogSets() {
  const bySet = new Map();
  for (const c of allCards()) {
    let s = bySet.get(c.set);
    if (!s) { s = { set: c.set, setName: c.setName || c.set, cards: [], base: [], variants: [] }; bySet.set(c.set, s); }
    s.cards.push(c);
    (isBaseCard(c) ? s.base : s.variants).push(c);
  }
  return [...bySet.values()].sort((a, b) => setRank(a.set) - setRank(b.set) || a.set.localeCompare(b.set));
}

const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, showcase: 4 };

/** Natural order inside a set: base cards by number, then variants. */
export function compareCollector(a, b) {
  return setRank(a.set) - setRank(b.set)
    || a.set.localeCompare(b.set)
    || (a.collectorNumber || '').localeCompare(b.collectorNumber || '', 'fr', { numeric: true });
}

export const SORTS = [
  { value: 'collector', label: tx('Extension et numéro') },
  { value: 'name', label: tx('Nom') },
  { value: 'rarity', label: tx('Rareté') },
  { value: 'quantity', label: tx('Quantité') },
  { value: 'recent', label: tx('Ajout récent') },
  { value: 'price', label: tx('Prix : le plus cher d’abord') },
  { value: 'priceAsc', label: tx('Prix : le moins cher d’abord') },
  { value: 'value', label: tx('Valeur du lot (prix × quantité)') },
];

/**
 * Price sorts of the collection: 'price' (unit price, most expensive first),
 * 'priceAsc' (cheapest first), 'value' (price × quantity). Cards without a
 * price always come last. `unitOf(stack)` → price of one copy or null.
 * Returns null for the other sorts.
 */
export function priceComparator(sort, unitOf, nameOf) {
  const get = sort === 'value'
    ? (s) => { const u = unitOf(s); return u == null ? null : u * s.quantity; }
    : unitOf;
  const dir = sort === 'priceAsc' ? 1 : -1;
  if (!['price', 'priceAsc', 'value'].includes(sort)) return null;
  return (a, b) => {
    const pa = get(a); const pb = get(b);
    if (pa == null || pb == null) return (pa == null) - (pb == null);
    return dir * (pa - pb) || nameOf(a).localeCompare(nameOf(b), 'fr');
  };
}

/** Comparator for collection stacks. `nameOf(stack)` gives the displayed name. */
export function stackComparator(sort, nameOf) {
  switch (sort) {
    case 'name': return (a, b) => nameOf(a).localeCompare(nameOf(b), 'fr');
    case 'rarity': return (a, b) => (RARITY_RANK[b.cardData.rarity] ?? -1) - (RARITY_RANK[a.cardData.rarity] ?? -1) || compareCollector(a.cardData, b.cardData);
    case 'quantity': return (a, b) => b.quantity - a.quantity || compareCollector(a.cardData, b.cardData);
    case 'recent': return (a, b) => b.scanTimestamp - a.scanTimestamp;
    default: return (a, b) => compareCollector(a.cardData, b.cardData);
  }
}
