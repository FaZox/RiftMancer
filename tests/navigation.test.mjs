// Lot 6 c and B.3: navigation — Decks | Matchs with the counter in one gesture, PC groups and status zone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { untx } from './helpers.mjs';

const { needsAttention } = await import('../src/lib/attention.js');
const read = (p) => untx(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const DAY = 864e5;

test('gold dot on « Plus » only when something waits on the phone', () => {
  const prefs = { syncReminderDays: 7 };
  const now = Date.UTC(2026, 10, 19);
  assert.equal(needsAttention({ paired: false, status: 'error' }, prefs, now), false, 'not paired: nothing');
  assert.equal(needsAttention({ paired: true, status: 'ok', pending: 0 }, prefs, now), false);
  assert.equal(needsAttention({ paired: true, status: 'error' }, prefs, now), true, 'sync failed');
  assert.equal(needsAttention({ paired: true, pcOffer: now }, prefs, now), true, 'the PC offers its data');
  assert.equal(needsAttention({ paired: true, pending: 3, pendingSince: now - 9 * DAY }, prefs, now), true, 'changes waiting 9 days');
  assert.equal(needsAttention({ paired: true, pending: 3, pendingSince: now - 2 * DAY }, prefs, now), false);
});

test('phone: Decks | Matchs, the matches left « Plus », « Compteur » on the Decks tab and in an open deck', () => {
  const tab = read('src/components/organize/DecksTab.jsx');
  assert.match(tab, /aria-label="Decks ou matchs"/);
  assert.match(tab, /<CounterFab /);
  assert.match(read('src/components/organize/OrganizeTab.jsx'), /onDeckOpen && <CounterFab org=\{org\} deck=\{open\}/);
  const more = read('src/components/more/MoreTab.jsx');
  assert.doesNotMatch(more, /id: 'matches'/);
  assert.match(more, /'Échanges et amis'/);
  assert.match(read('src/App.jsx'), /<DecksTab /);
});

test('PC: five groups in the order of B.3, status zone at the bottom', () => {
  const s = read('src/desktop/Sidebar.jsx');
  const titles = [...s.matchAll(/title: '([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(titles, ['Ma collection', 'Jouer', 'Ajouter', 'Organiser']);
  const ids = [...s.matchAll(/\{ id: '(\w+)'/g)].map(m => m[1]);
  assert.deepEqual(ids, ['collection', 'value', 'decks', 'matches', 'scan', 'boxes', 'loans', 'trades']);
  assert.match(s, /<StatusZone onSettings=\{onSettings\} \/>/);
  assert.match(s, /onSettings\('content'\)/);
});
