import { tx, locale } from './i18n.js';
/**
 * Between friends, without a server (lot 10). Each one exports a small file
 * with his doubles and his wishes — card ids and quantities only: no purchase
 * prices, no locations, no notes — and drops it where he likes (Drive,
 * message…). The friend imports it in « Amis »: one entry per person (a
 * `people` record, synced like the others), replaced at each new import.
 * Nothing is ever sent by the app.
 */
export const LIST_FORMAT = 'riftbound-liste';
export const LIST_VERSION = 1;
const MAX_ENTRIES = 5000;
const MAX_QTY = 99;
const CARD_ID = /^[a-z0-9]{2,5}-[a-z0-9*]{1,6}(-[a-z0-9*-]{1,20})?$/;

// « Garder N exemplaires par carte, le reste est échangeable » (shared with Mes doubles)
export const KEEP_KEY = 'riftbound_trade_threshold';
export function readKeep(storage = globalThis.localStorage) {
  try { return Number(storage?.getItem(KEEP_KEY)) || 3; } catch { return 3; }
}
export function writeKeep(n, storage = globalThis.localStorage) {
  try { storage?.setItem(KEEP_KEY, String(n)); } catch { /* ignore */ }
}

// A stable random id of this collection, so that a friend's new list replaces the old one
const MY_ID_KEY = 'rb.friends.myId';
export function myListId(storage = globalThis.localStorage) {
  let id = null;
  try { id = storage?.getItem(MY_ID_KEY); } catch { /* ignore */ }
  if (!id) {
    id = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    try { storage?.setItem(MY_ID_KEY, id); } catch { /* ignore */ }
  }
  return id;
}

/** Copies owned per card (all languages, finishes, places). */
export function ownedByCard(stacks) {
  const m = new Map();
  for (const s of stacks) m.set(s.cardData.id, (m.get(s.cardData.id) || 0) + s.quantity);
  return m;
}

/** My doubles: what is above `keep` copies of a card. */
export function spareCards(stacks, keep = 3) {
  return [...ownedByCard(stacks)].filter(([, n]) => n > keep).map(([cardId, n]) => ({ cardId, quantity: n - keep }));
}

/** My wishes still missing: wanted minus owned. */
export function missingWishes(wishItems, owned) {
  return wishItems
    .map(w => ({ cardId: w.cardId, quantity: (w.quantity || 1) - (owned.get(w.cardId) || 0) }))
    .filter(w => w.quantity > 0);
}

/** The file content I give to my friends. */
export function buildMyList({ name, stacks, wishItems, keep = 3, id, now = Date.now() }) {
  const sorted = (l) => [...l].sort((a, b) => a.cardId.localeCompare(b.cardId));
  return {
    format: LIST_FORMAT, version: LIST_VERSION, id, name: (name || '').trim().slice(0, 40), exportedAt: now,
    haves: sorted(spareCards(stacks, keep)),
    wants: sorted(missingWishes(wishItems, ownedByCard(stacks))),
  };
}

export function listFileName(name, now = Date.now()) {
  const slug = (name || 'ami').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ami';
  return `liste-riftbound-${slug}-${new Date(now).toISOString().slice(0, 10)}.json`;
}

const fail = (msg) => { throw new Error(msg); };
function entries(raw, what) {
  if (!Array.isArray(raw)) fail(tx('Fichier incomplet ({what} manquants).', { what }));
  if (raw.length > MAX_ENTRIES) fail(tx('Fichier trop grand.'));
  const byCard = new Map();
  for (const e of raw) {
    const q = Math.floor(Number(e?.quantity));
    if (typeof e?.cardId !== 'string' || !CARD_ID.test(e.cardId) || !(q >= 1)) continue; // a bad line is skipped
    byCard.set(e.cardId, Math.min(MAX_QTY, (byCard.get(e.cardId) || 0) + q));
  }
  return [...byCard].map(([cardId, quantity]) => ({ cardId, quantity }));
}

/** A friend's file → { id, name, exportedAt, haves, wants }; throws a French message when it is not one. */
export function parseFriendList(text) {
  let o;
  try { o = JSON.parse(text); } catch { fail(tx('Ce fichier n’est pas une liste Riftbound.')); }
  if (o?.format !== LIST_FORMAT) fail(tx('Ce fichier n’est pas une liste Riftbound.'));
  if (!(o.version >= 1)) fail(tx('Version de liste inconnue.'));
  if (o.version > LIST_VERSION) fail(tx('Cette liste vient d’une version plus récente de l’appli : mettez l’appli à jour.'));
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 40) : '';
  return {
    id: typeof o.id === 'string' ? o.id.slice(0, 40) : null,
    name,
    exportedAt: Number.isFinite(o.exportedAt) ? o.exportedAt : null,
    haves: entries(o.haves, 'doubles'),
    wants: entries(o.wants, 'souhaits'),
  };
}

/**
 * Where a list goes: the person who sent the same list id before, else the
 * person of the same name (ignoring case and accents), else a new person.
 * Returns the fields to save (an update keeps the person's id and note).
 */
export function personForList(people, list, fallbackName = 'Ami') {
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const found = (list.id && people.find(p => p.list?.id === list.id))
    || (list.name && people.find(p => norm(p.name) === norm(list.name)));
  const stored = { id: list.id, at: list.exportedAt, importedAt: Date.now(), haves: list.haves, wants: list.wants };
  return found
    ? { record: { ...found, list: stored }, created: false }
    : { record: { name: list.name || fallbackName, note: '', list: stored }, created: true };
}

/**
 * What can be traded with a friend:
 *   forMe   his doubles that are on my wish list (up to what I still miss)
 *   forThem my doubles that are on his wish list (up to what he wants)
 */
export function tradeMatches(friendList, myStacks, myWishItems, keep = 3) {
  const owned = ownedByCard(myStacks);
  const myWants = new Map(missingWishes(myWishItems, owned).map(w => [w.cardId, w.quantity]));
  const mySpares = new Map(spareCards(myStacks, keep).map(s => [s.cardId, s.quantity]));
  const meet = (offer, want) => offer
    .filter(o => want.has(o.cardId))
    .map(o => ({ cardId: o.cardId, quantity: Math.min(o.quantity, want.get(o.cardId)) }));
  return {
    forMe: meet(friendList?.haves || [], myWants),
    forThem: meet([...mySpares].map(([cardId, quantity]) => ({ cardId, quantity })), new Map((friendList?.wants || []).map(w => [w.cardId, w.quantity]))),
  };
}

export const count = (items) => items.reduce((n, i) => n + i.quantity, 0);
export const itemsValue = (items, priceOf) => items.reduce((v, i) => v + (priceOf(i.cardId) || 0) * i.quantity, 0);

/** Calculator: the gap between both sides; fair under 10 % of the bigger side. */
export function tradeGap(give, get) {
  const diff = get - give;
  const big = Math.max(give, get);
  const share = big > 0 ? Math.abs(diff) / big : 0;
  return { diff, share, fair: share < 0.1 };
}

/** « liste du 12 nov. » */
export function listDate(at) {
  return at ? tx('liste du {date}', { date: new Date(at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) }) : tx('liste sans date');
}
