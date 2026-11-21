import { tx, tp } from './i18n.js';
/**
 * Notes per opponent (lot 7.4, B.6.3, tel-16): for each opposing Legend, notes
 * and a sideboard plan (cards to take out of the deck, cards to bring in from
 * the reserve). Kept in the deck record (`opponents`, synced and backed up
 * with it). Pure: tests/opponentNotes.test.mjs.
 *
 * deck.opponents = { [legendId]: { note, out: [{ cardId, quantity }], in: [{ cardId, quantity }], at } }
 */

const same = (x) => x;

/** The plan against a Legend (empty when there is none). */
export function planFor(deck, legendId, canon = same) {
  const p = legendId ? deck?.opponents?.[canon(legendId)] : null;
  return { note: p?.note || '', out: p?.out || [], in: p?.in || [], at: p?.at || null };
}

export const hasPlan = (p) => !!(p && (p.note?.trim() || p.out?.length || p.in?.length));

/**
 * One line per Legend met with this deck, or prepared in advance:
 * [{ legendId, games, wins, rate, plan }] — most played first, then the others.
 */
export function opponentRows(deck, matches, canon = same) {
  const rows = new Map();
  const row = (id) => {
    if (!rows.has(id)) rows.set(id, { legendId: id, games: 0, wins: 0, rate: null });
    return rows.get(id);
  };
  for (const m of matches || []) {
    if (m.deleted || m.deckId !== deck.id || !m.oppLegendId) continue;
    const r = row(canon(m.oppLegendId));
    r.games++;
    if (m.result === 'win') r.wins++;
  }
  for (const [id, p] of Object.entries(deck.opponents || {})) if (hasPlan(p)) row(id);
  for (const r of rows.values()) {
    r.rate = r.games ? Math.round((100 * r.wins) / r.games) : null;
    r.plan = planFor(deck, r.legendId);
  }
  return [...rows.values()].sort((a, b) => b.games - a.games || Number(hasPlan(b.plan)) - Number(hasPlan(a.plan)));
}

/** The deck with the plan against `legendId` changed (an empty plan is removed). */
export function setPlan(deck, legendId, patch, now = Date.now()) {
  const opponents = { ...(deck.opponents || {}) };
  const p = { ...planFor(deck, legendId), ...patch, at: now };
  if (hasPlan(p)) opponents[legendId] = { note: p.note, out: p.out, in: p.in, at: p.at };
  else delete opponents[legendId];
  return { ...deck, opponents };
}

/**
 * What can go in each column: « Sortir » takes cards of the deck itself,
 * « Rentrer » cards of the reserve — with the number of copies available.
 */
export function planChoices(deck) {
  const sum = (zone) => {
    const m = new Map();
    for (const s of deck.cards || []) if (s.zone === zone) m.set(s.cardId, (m.get(s.cardId) || 0) + (s.quantity || 0));
    return m;
  };
  return { out: sum('main'), in: sum('side') };
}

/** A column with `cardId` changed by `delta` copies, kept within 0 … max. */
export function adjust(list, cardId, delta, max = Infinity) {
  const cur = list.find(s => s.cardId === cardId)?.quantity || 0;
  const q = Math.max(0, Math.min(max, cur + delta));
  const rest = list.filter(s => s.cardId !== cardId);
  return q ? (cur ? list.map(s => (s.cardId === cardId ? { cardId, quantity: q } : s)) : [...rest, { cardId, quantity: q }]) : rest;
}

/**
 * What is wrong with a plan, for a short line under it: more copies out than
 * in (or the reverse) leaves the deck short or over its size; a card no longer
 * in the deck (or the reserve) cannot follow the plan.
 */
export function planIssues(deck, plan) {
  const choices = planChoices(deck);
  const n = (l) => l.reduce((t, s) => t + s.quantity, 0);
  const issues = [];
  const out = n(plan.out), inn = n(plan.in);
  if (out !== inn) issues.push(tx('{out} carte{v1} sortie{v2}, {inn} rentrée{v4}', { out, v1: out > 1 ? 's' : '', v2: out > 1 ? 's' : '', inn, v4: inn > 1 ? 's' : '' }));
  const gone = [...plan.out.filter(s => (choices.out.get(s.cardId) || 0) < s.quantity), ...plan.in.filter(s => (choices.in.get(s.cardId) || 0) < s.quantity)];
  if (gone.length) issues.push(tp(gone.length, '{n} carte du plan n’est plus dans le deck en nombre suffisant', '{n} cartes du plan ne sont plus dans le deck en nombre suffisant'));
  return issues;
}
