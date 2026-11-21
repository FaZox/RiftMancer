import { tx } from './i18n.js';
/**
 * Match statistics (« Matchs »): win rate overall, per deck, per Legend played,
 * matchup matrix (my Legend × opposing Legend), going first / second, events.
 * Small samples (< SMALL_SAMPLE games) are flagged so the UI can grey them.
 */

export const SMALL_SAMPLE = 5;
export const RESULT_LABEL = { win: tx('Victoire'), loss: tx('Défaite'), draw: tx('Nul') };

/** Overall result of a match (Bo3: from its games when the field is missing). */
export function matchResult(m) {
  if (m.result) return m.result;
  const g = m.games || [];
  const w = g.filter(x => x.result === 'win').length;
  const l = g.filter(x => x.result === 'loss').length;
  return w > l ? 'win' : l > w ? 'loss' : 'draw';
}

export function record(list, resultOf = matchResult) {
  const r = { n: 0, win: 0, loss: 0, draw: 0 };
  for (const m of list) { r.n++; r[resultOf(m)]++; }
  r.winrate = r.n ? r.win / r.n : null;
  r.small = r.n < SMALL_SAMPLE;
  return r;
}

function groupBy(list, keyOf) {
  const map = new Map();
  for (const m of list) {
    const k = keyOf(m);
    if (k == null || k === '') continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  }
  return map;
}

/** Games (Bo3 games, or the match itself) with who went first. */
export function gamesOf(matches) {
  const out = [];
  for (const m of matches) {
    if (m.games?.length) for (const g of m.games) out.push({ result: g.result, wentFirst: g.wentFirst ?? m.wentFirst });
    else out.push({ result: matchResult(m), wentFirst: m.wentFirst });
  }
  return out;
}

/**
 * @param {object} [opts]
 * @param {(id: string) => string} [opts.legendOf]  id → reference id of the
 *   same Legend (legends.js canonicalLegendId): alternate arts are counted
 *   with their Legend, on one line of the matchups.
 */
export function computeStats(matches, { legendOf = (id) => id } = {}) {
  const live = matches.filter(m => !m.deleted).map(m => ({
    ...m,
    myLegendId: m.myLegendId ? legendOf(m.myLegendId) : m.myLegendId,
    oppLegendId: m.oppLegendId ? legendOf(m.oppLegendId) : m.oppLegendId,
  }));
  // Matchups and first / second: duels only (lot 7.5: 2v2 and chacun pour soi are counted overall, per deck and per mode)
  const duel = live.filter(m => !m.mode || m.mode === '1v1');
  const games = gamesOf(duel);
  const byMode = live.some(m => m.mode && m.mode !== '1v1')
    ? [...groupBy(live, m => m.mode || '1v1')].map(([key, l]) => ({ key, ...record(l) }))
    : [];
  const byDeck = [...groupBy(live, m => m.deckId)].map(([key, l]) => ({ key, ...record(l) }));
  // Lot 7.3: per version of a deck (matches that know the version played)
  const byDeckVersion = [...groupBy(live.filter(m => m.deckId && m.deckVersion != null), m => `${m.deckId}|${m.deckVersion}`)].map(([key, l]) => ({ key, ...record(l) }));
  const byLegend = [...groupBy(duel, m => m.myLegendId)].map(([key, l]) => ({ key, ...record(l) }));
  const byOpponent = [...groupBy(duel, m => m.oppLegendId)].map(([key, l]) => ({ key, ...record(l) }));
  const rows = byLegend.map(r => r.key);
  const cols = byOpponent.map(r => r.key);
  const cells = {};
  for (const m of duel) {
    if (!m.myLegendId || !m.oppLegendId) continue;
    const k = `${m.myLegendId}|${m.oppLegendId}`;
    (cells[k] ||= []).push(m);
  }
  const matrix = { rows, cols, cell: (a, b) => (cells[`${a}|${b}`] ? record(cells[`${a}|${b}`]) : null) };
  const events = [...groupBy(live, m => m.eventId || m.eventName)].map(([key, l]) => ({
    key,
    name: l[0].eventName || tx('Événement'),
    date: Math.min(...l.map(m => m.date || m.createdAt || 0)),
    matches: [...l].sort((a, b) => (a.round || 0) - (b.round || 0) || (a.date || 0) - (b.date || 0)),
    ...record(l),
  })).sort((a, b) => b.date - a.date);
  const byN = (a, b) => b.n - a.n;
  return {
    overall: record(live),
    first: record(games.filter(g => g.wentFirst === true), g => g.result),
    second: record(games.filter(g => g.wentFirst === false), g => g.result),
    byDeck: byDeck.sort(byN),
    byDeckVersion: byDeckVersion.sort((a, b) => String(a.key).localeCompare(String(b.key), 'fr', { numeric: true })),
    byMode: byMode.sort(byN),
    byLegend: byLegend.sort(byN),
    byOpponent: byOpponent.sort(byN),
    matrix,
    events,
  };
}

/** CSV (« ; », French Excel) of the matches. `name(id)` resolves card / deck names. */
export function matchesToCsv(matches, { cardName = (id) => id, deckName = (id) => id } = {}) {
  const head = ['Date', tx('Événement'), 'Ronde', 'Deck', tx('Ma Légende'), tx('Légende adverse'), 'Adversaire', 'Format', 'Premier', tx('Résultat'), 'Manches', 'Notes'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(';')];
  for (const m of [...matches].filter(x => !x.deleted).sort((a, b) => (a.date || 0) - (b.date || 0))) {
    const games = (m.games || []).map(g => `${g.result === 'win' ? 'V' : g.result === 'loss' ? 'D' : 'N'} ${g.myScore ?? ''}-${g.oppScore ?? ''}`.trim()).join(' / ');
    lines.push([
      new Date(m.date || m.createdAt || Date.now()).toISOString().slice(0, 10),
      m.eventName, m.round, m.deckId ? deckName(m.deckId) : '', m.myLegendId ? cardName(m.myLegendId) : '',
      m.oppLegendId ? cardName(m.oppLegendId) : '', m.oppName, `${m.mode === '2v2' ? '2v2 ' : m.mode === 'ffa' ? `Chacun pour soi (${m.players || '?'}) ` : ''}${(m.format || 'bo1').toUpperCase()}`,
      m.wentFirst == null ? '' : m.wentFirst ? 'oui' : 'non', RESULT_LABEL[matchResult(m)], games, m.notes,
    ].map(esc).join(';'));
  }
  return '﻿' + lines.join('\r\n');
}
