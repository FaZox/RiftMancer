// Lot 7.5: counter modes, point by point history, a game in progress resumed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, sidesOf, scoreOf, addPoint, removePoint, undoLast, leader, scoreText, packLog, unpackLog,
  resumable, loadRunning, saveRunning, clearRunning, RUNNING_KEY, RUNNING_MAX_AGE,
} from '../src/lib/scoreGame.js';
import { computeStats, matchesToCsv } from '../src/lib/matchStats.js';

test('modes: 1v1 and 2v2 on two sides (8 and 11 points), chacun pour soi with 3 or 4 players', () => {
  assert.equal(MODES['1v1'].target, 8);
  assert.equal(MODES['2v2'].target, 11);
  assert.equal(sidesOf('1v1'), 2);
  assert.equal(sidesOf('2v2', 4), 2);
  assert.equal(sidesOf('ffa', 3), 3);
  assert.equal(sidesOf('ffa', 9), 4);
});

test('the score comes from the history: + adds a point, − removes that player’s last point, « Annuler » the last one', () => {
  let log = [];
  for (const s of [0, 1, 0, 0, 1]) log = addPoint(log, s, 2, 8);
  assert.deepEqual(scoreOf(log, 2), [3, 2]);
  assert.equal(scoreText(log, 2), '3 – 2');
  log = removePoint(log, 1);
  assert.deepEqual(log, [0, 1, 0, 0]);
  assert.deepEqual(removePoint([0, 0], 1), [0, 0]); // nothing to remove
  log = undoLast(log);
  assert.deepEqual(log, [0, 1, 0]);
  assert.equal(packLog(log), '010');
  assert.deepEqual(unpackLog('0102'), [0, 1, 0, 2]);
});

test('a player stops at the target; the leader is the one who reached it', () => {
  let log = [];
  for (let i = 0; i < 12; i++) log = addPoint(log, 2, 3, 8);
  assert.deepEqual(scoreOf(log, 3), [0, 0, 8]);
  assert.equal(leader(log, 3, 8), 2);
  assert.equal(leader([0, 1], 2, 8), null);
});

test('a game in progress is offered again if it has points, is not saved and is recent', () => {
  const now = 1e12;
  assert.equal(resumable({ log: [0, 1], at: now - 1000 }, now), true);
  assert.equal(resumable({ log: [], games: [{ result: 'win' }], at: now }, now), true);
  assert.equal(resumable({ log: [], games: [], at: now }, now), false);
  assert.equal(resumable({ log: [0], saved: true, at: now }, now), false);
  assert.equal(resumable({ log: [0], at: now - RUNNING_MAX_AGE - 1 }, now), false);
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  saveRunning({ mode: '2v2', log: [0, 0, 1], games: [], at: Date.now() }, storage);
  assert.deepEqual(loadRunning(storage).log, [0, 0, 1]);
  saveRunning({ mode: '2v2', log: [], games: [], at: Date.now() }, storage); // back to 0 – 0: nothing to resume
  assert.equal(mem.has(RUNNING_KEY), false);
  saveRunning({ mode: '1v1', log: [1], games: [], at: Date.now() }, storage);
  clearRunning(storage);
  assert.equal(loadRunning(storage), null);
});

test('statistics: 2v2 and chacun pour soi count overall and per mode, not in the 1v1 matchups', () => {
  const ms = [
    { mode: '1v1', myLegendId: 'a', oppLegendId: 'b', result: 'win', wentFirst: true },
    { myLegendId: 'a', oppLegendId: 'b', result: 'loss', wentFirst: false }, // older match: a duel
    { mode: '2v2', myLegendId: 'a', oppLegendId: 'c', result: 'win', wentFirst: true },
    { mode: 'ffa', players: 4, myLegendId: 'a', oppLegendId: null, result: 'loss' },
  ];
  const s = computeStats(ms);
  assert.equal(s.overall.n, 4);
  assert.deepEqual(s.byOpponent.map(r => [r.key, r.n]), [['b', 2]]);
  assert.equal(s.first.n, 1);
  assert.deepEqual(s.byMode.map(r => [r.key, r.n]).sort(), [['1v1', 2], ['2v2', 1], ['ffa', 1]]);
  assert.deepEqual(computeStats(ms.slice(0, 2)).byMode, []); // duels only: no « Par mode » table
  assert.match(matchesToCsv(ms), /Chacun pour soi \(4\) BO1/);
});
