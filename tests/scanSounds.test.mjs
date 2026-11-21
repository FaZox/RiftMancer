// Lot 8.2: optional scan sounds — three distinct sounds, off by default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';
import { SOUNDS, soundFor, VOLUMES } from '../src/lib/scanSounds.js';
import { getPrefs } from '../src/lib/uiPrefs.js';

test('sounds are off by default (a new install stays silent)', () => {
  assert.equal(getPrefs().scanSounds, false);
  assert.equal(soundFor('success', getPrefs()), null);
});

test('on: one sound per result, none for « non reconnue » or an empty table', () => {
  const p = { scanSounds: true };
  assert.equal(soundFor('success', p), 'success');
  assert.equal(soundFor('uncertain', p), 'uncertain');
  assert.equal(soundFor('duplicate', p), 'duplicate');
  assert.equal(soundFor('fail', p), null);
  assert.equal(soundFor('empty', p), null);
});

test('the three sounds can be told apart, and are short', () => {
  const shape = (s) => JSON.stringify([s.wave, s.notes.map(n => [n[0], n[2]])]);
  const shapes = Object.values(SOUNDS).map(shape);
  assert.equal(new Set(shapes).size, 3);
  for (const s of Object.values(SOUNDS)) {
    const end = Math.max(...s.notes.map(([, start, len]) => start + len));
    assert.ok(end <= 0.25, 'under a quarter of a second');
  }
  assert.deepEqual(VOLUMES.map(v => v[1]), ['Faible', 'Moyen', 'Fort']);
});
