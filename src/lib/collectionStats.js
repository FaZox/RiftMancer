/**
 * Collection statistics for the PC « Salle du trésor », the set pages and the
 * « Chronique » (pure: no React, no catalog loaded — tests/collectionStats.test.mjs).
 */
import { setRank } from './catalogOrder.js';

export const MILESTONES = [0.25, 0.5, 0.75, 1];

const domainsOf = (c) => (c.domains?.length ? c.domains : (c.domain ? [c.domain] : [])).filter(Boolean);

/**
 * Progress per set, in release order.
 * `ownedByCard`: Map(cardId → copies); `catalog`: cardData[] (set, setName, rarity, domains).
 * → [{ code, name, owned, total, pct, byRarity: { r: [owned, total] }, byDomain: { d: [owned, total] } }]
 */
export function setProgress(ownedByCard, catalog) {
  const by = new Map();
  for (const c of catalog || []) {
    if (!c?.set) continue;
    let s = by.get(c.set);
    if (!s) { s = { code: c.set, name: c.setName || c.set, owned: 0, total: 0, pct: 0, byRarity: {}, byDomain: {} }; by.set(c.set, s); }
    const has = (ownedByCard?.get?.(c.id) || 0) > 0;
    s.total++;
    if (has) s.owned++;
    const r = (s.byRarity[c.rarity] ||= [0, 0]);
    r[1]++; if (has) r[0]++;
    for (const d of domainsOf(c)) {
      const x = (s.byDomain[d] ||= [0, 0]);
      x[1]++; if (has) x[0]++;
    }
  }
  const list = [...by.values()];
  for (const s of list) s.pct = s.total ? s.owned / s.total : 0;
  return list.sort((a, b) => setRank(a.code) - setRank(b.code) || a.code.localeCompare(b.code));
}

/** Next completion milestone (25 / 50 / 75 / 100 %): { pct, missing } or null when the set is complete. */
export function nextMilestone(owned, total) {
  if (!total || owned >= total) return null;
  for (const pct of MILESTONES) {
    const need = Math.ceil(total * pct - 1e-9);
    if (owned < need) return { pct, missing: need - owned };
  }
  return null;
}

/** Most valuable owned card (priceOf(cardData) → €); without prices: the latest showcase added, else the latest card added. → cardData | null */
export function masterpiece(stacks, priceOf) {
  let best = null; let bestPrice = 0;
  for (const s of stacks || []) {
    const p = priceOf?.(s.cardData, s) ?? null;
    if (p != null && p > bestPrice) { best = s.cardData; bestPrice = p; }
  }
  if (best) return best;
  const latestOf = (keep) => {
    let latest = null; let at = -1;
    for (const s of stacks || []) {
      if (!s.cardData || !keep(s.cardData)) continue;
      const t = s.scanTimestamp || 0;
      if (t >= at) { latest = s.cardData; at = t; }
    }
    return latest;
  };
  return latestOf(c => c.rarity === 'showcase') || latestOf(() => true);
}

const pad = (n) => String(n).padStart(2, '0');
/** Local calendar day of a timestamp: 'YYYY-MM-DD'. */
export function localDay(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
const mondayOf = (t) => { const d = new Date(startOfDay(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

/**
 * Totals of the header: { total, different, value, pct, addedWeek, valueSinceMonday }.
 * `valueSince(t)` (optional): value of the collection at time t (history), for the change since Monday.
 */
export function collectionSummary(stacks, { catalogSize = 0, value = 0, copies = [], now = Date.now(), valueAt = null } = {}) {
  const ids = new Set();
  let total = 0;
  for (const s of stacks || []) { total += s.quantity; ids.add(s.cardData.id); }
  const monday = mondayOf(now);
  let addedWeek = 0;
  for (const c of copies || []) if (!c.deleted && c.createdAt >= monday) addedWeek++;
  const base = valueAt ? valueAt(monday) : null;
  return {
    total, different: ids.size, value,
    pct: catalogSize ? ids.size / catalogSize : 0,
    addedWeek,
    valueSinceMonday: base != null ? value - base : null,
  };
}

/**
 * Copies added, grouped by LOCAL day, most recent first:
 * [{ day, cards: [{ cardId, quantity, first, source }], count, value }].
 * `days` (default: all) keeps the last n days. `first`: no older copy of the card.
 * `priceOf(copy) → €` is optional (value of the day).
 */
export function recentAdds(copies, { days = null, now = Date.now(), priceOf = null } = {}) {
  const live = (copies || []).filter(c => c && !c.deleted && c.createdAt);
  const firstAt = new Map();
  for (const c of live) {
    const t = firstAt.get(c.cardId);
    if (t == null || c.createdAt < t) firstAt.set(c.cardId, c.createdAt);
  }
  const from = days ? startOfDay(addDays(now, -(days - 1))) : -Infinity;
  const byDay = new Map();
  for (const c of live) {
    if (c.createdAt < from) continue;
    const day = localDay(c.createdAt);
    let d = byDay.get(day);
    if (!d) { d = { day, cards: new Map(), count: 0, value: 0 }; byDay.set(day, d); }
    d.count++;
    if (priceOf) d.value += priceOf(c) || 0;
    let card = d.cards.get(c.cardId);
    if (!card) {
      card = { cardId: c.cardId, quantity: 0, first: firstAt.get(c.cardId) >= startOfDay(c.createdAt), source: c.source || null, at: c.createdAt };
      d.cards.set(c.cardId, card);
    }
    card.quantity++;
    if (c.createdAt > card.at) card.at = c.createdAt;
  }
  return [...byDay.values()]
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .map(d => ({ ...d, cards: [...d.cards.values()].sort((a, b) => b.at - a.at).map(({ at, ...x }) => x) }));
}

/** Copies added per day over the last `days` days (oldest first): [{ day, n }]. */
export function activity(copies, { days = 14, now = Date.now() } = {}) {
  const counts = new Map();
  for (const c of copies || []) if (c && !c.deleted && c.createdAt) counts.set(localDay(c.createdAt), (counts.get(localDay(c.createdAt)) || 0) + 1);
  const out = [];
  for (let i = days - 1; i >= 0; i--) { const day = localDay(addDays(startOfDay(now), -i)); out.push({ day, n: counts.get(day) || 0 }); }
  return out;
}

/** Showcase art of a set (background of the portals): the first showcase, else the first rare, else the first card. */
export function setArt(code, catalog) {
  const cards = (catalog || []).filter(c => c.set === code);
  return cards.find(c => c.rarity === 'showcase') || cards.find(c => c.rarity === 'rare') || cards[0] || null;
}
