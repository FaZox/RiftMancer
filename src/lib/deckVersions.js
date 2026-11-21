/**
 * Versions of a deck (lot 7.3, B.6.3): save a named version, compare two,
 * win rate per version. A version is a copy of the deck's list kept in the
 * deck record (`versions`, synced and backed up with it); a match keeps the
 * version played (`deckVersion`). Pure: tests/deckVersions.test.mjs.
 */

/** The deck's list as it is now: what a version keeps. */
const listOf = (deck) => ({
  legendId: deck.legendId || null,
  championId: deck.championId || null,
  format: deck.format || 'standard',
  cards: (deck.cards || []).map(s => ({ cardId: s.cardId, zone: s.zone, quantity: s.quantity })),
});

/** Number of the last saved version (0: none yet). */
export const currentVersion = (deck) => (deck?.versions?.length ? deck.versions.at(-1).n : 0);

/** The deck with a new version saved: « v{n} · {name} ». */
export function saveVersion(deck, name = '', now = Date.now()) {
  const versions = deck.versions || [];
  const n = (versions.at(-1)?.n || 0) + 1;
  return { ...deck, versions: [...versions, { n, name: String(name).trim().slice(0, 60), at: now, ...listOf(deck) }] };
}

/** Has the deck changed since its last version? */
export function changedSinceVersion(deck) {
  const v = deck?.versions?.at(-1);
  if (!v) return true;
  return JSON.stringify(listOf(deck)) !== JSON.stringify({ legendId: v.legendId, championId: v.championId, format: v.format, cards: v.cards });
}

const key = (s) => `${s.zone}|${s.cardId}`;
const count = (list) => {
  const m = new Map();
  for (const s of list.cards || []) m.set(key(s), { cardId: s.cardId, zone: s.zone, quantity: (m.get(key(s))?.quantity || 0) + (s.quantity || 0) });
  if (list.legendId) m.set(`legend|${list.legendId}`, { cardId: list.legendId, zone: 'legend', quantity: 1 });
  if (list.championId) m.set(`champion|${list.championId}`, { cardId: list.championId, zone: 'champion', quantity: 1 });
  return m;
};

/**
 * From version (or deck list) `a` to `b`: { added: [{ cardId, zone, quantity }],
 * removed: [...] } — a card going from 2 to 3 copies is « +1 ».
 */
export function diffVersions(a, b) {
  const A = count(a), B = count(b);
  const added = [], removed = [];
  for (const [k, s] of B) {
    const d = s.quantity - (A.get(k)?.quantity || 0);
    if (d > 0) added.push({ ...s, quantity: d });
  }
  for (const [k, s] of A) {
    const d = s.quantity - (B.get(k)?.quantity || 0);
    if (d > 0) removed.push({ ...s, quantity: d });
  }
  return { added, removed };
}

/** The version a new match of this deck was played with. */
export function withDeckVersion(match, decks) {
  if (!match?.deckId || match.deckVersion != null) return match;
  const deck = decks?.byId?.get(match.deckId);
  const n = currentVersion(deck);
  return n ? { ...match, deckVersion: n } : match;
}

/** Win rate of each version of a deck: Map(n → { games, wins, rate }). */
export function versionStats(matches, deckId) {
  const out = new Map();
  for (const m of matches || []) {
    if (m.deleted || m.deckId !== deckId || m.deckVersion == null) continue;
    const r = out.get(m.deckVersion) || { games: 0, wins: 0, rate: 0 };
    r.games++;
    if (m.result === 'win') r.wins++;
    r.rate = Math.round((100 * r.wins) / r.games);
    out.set(m.deckVersion, r);
  }
  return out;
}
