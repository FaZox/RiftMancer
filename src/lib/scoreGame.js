import { tx } from './i18n.js';
/**
 * Points counter (lot 7.5, B.6.4): modes 1v1 / 2v2 / chacun pour soi, point
 * by point history, a game in progress kept to be resumed. Pure apart from
 * the storage helpers: tests/scoreGame.test.mjs.
 *
 * A game: { mode, players, log: [side, side, …] } — one entry per point
 * scored, in order; side 0 is me (or my team). The score is derived from the
 * log, so the history can never disagree with it.
 */

export const MODES = {
  '1v1': { label: '1v1', sides: 2, target: 8 },
  '2v2': { label: '2v2', sides: 2, target: 11 },
  ffa: { label: tx('Chacun pour soi'), sides: 4, target: 8 },
};

/** Number of sides of a game (2, or 3 / 4 players in chacun pour soi). */
export const sidesOf = (mode, players) => (mode === 'ffa' ? Math.max(3, Math.min(4, players || 4)) : 2);

export const scoreOf = (log, sides) => {
  const s = Array(sides).fill(0);
  for (const x of log) if (x >= 0 && x < sides) s[x]++;
  return s;
};

/** One point for `side`, unless it already reached the target. */
export function addPoint(log, side, sides, target) {
  return scoreOf(log, sides)[side] >= target ? log : [...log, side];
}

/** One point less for `side`: its last point leaves the history. */
export function removePoint(log, side) {
  const i = log.lastIndexOf(side);
  return i < 0 ? log : [...log.slice(0, i), ...log.slice(i + 1)];
}

/** « Annuler le dernier point ». */
export const undoLast = (log) => log.slice(0, -1);

/** The side that reached the target, or null. */
export function leader(log, sides, target) {
  const i = scoreOf(log, sides).findIndex(s => s >= target);
  return i < 0 ? null : i;
}

/** « 5 – 3 », « 5 – 3 – 2 » — the score as said in the resume question. */
export const scoreText = (log, sides) => scoreOf(log, sides).join(' – ');

/** The history kept with a game of the match: « 0110… », one digit per point. */
export const packLog = (log) => log.join('');
export const unpackLog = (s) => [...String(s || '')].map(Number).filter(n => Number.isInteger(n));

// ── The game in progress ────────────────────────────────────────────────────

export const RUNNING_KEY = 'rb.counter.running';
/** Older than this, a game in progress is not offered again. */
export const RUNNING_MAX_AGE = 24 * 3600e3;

/** Worth resuming: points scored or a game finished, not saved yet, recent. */
export function resumable(state, now = Date.now()) {
  if (!state || state.saved) return false;
  if (!(state.log?.length || state.games?.length)) return false;
  return now - (state.at || 0) < RUNNING_MAX_AGE;
}

export function loadRunning(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(RUNNING_KEY) || 'null'); } catch { return null; }
}
export function saveRunning(state, storage = globalThis.localStorage) {
  try {
    if (resumable(state, state.at)) storage.setItem(RUNNING_KEY, JSON.stringify(state));
    else storage.removeItem(RUNNING_KEY);
  } catch { /* storage unavailable: nothing to resume later */ }
}
export function clearRunning(storage = globalThis.localStorage) {
  try { storage.removeItem(RUNNING_KEY); } catch { /* ignore */ }
}
