// « Grille » mode: the page is taken when the same cards stay still, then not again until the page changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGridWatcher, sameLayout, readingOrder, gridHint, sessionLine, GRID } from '../src/lib/gridScan.js';

const W = 720, H = 1280;
/** A 3×3 binder page: card centres, shifted by (dx, dy) pixels. */
const page = (dx = 0, dy = 0, n = 9) => Array.from({ length: n }, (_, i) => ({
  cx: 140 + (i % 3) * 220 + dx, cy: 260 + Math.floor(i / 3) * 300 + dy, w: 200, h: 280,
}));
/** Grey signature: a flat picture of level v (cornerCache shape). */
const sig = (v) => ({ w: 16, h: 12, data: new Uint8Array(16 * 12).fill(v) });

test('same cards in the same place: count and centres within the tolerance', () => {
  assert.ok(sameLayout(page(), page(10, -8), W, H), 'a few pixels of hand shake');
  assert.ok(!sameLayout(page(), page(80, 0), W, H), 'the phone moved');
  assert.ok(!sameLayout(page(), page(0, 0, 8), W, H), 'one card fewer');
  assert.ok(!sameLayout([], [], W, H), 'nothing is never « the same page »');
  assert.ok(sameLayout(page(), [...page()].reverse(), W, H), 'order of the detections does not matter');
});

test('the photo is taken after the page stays still, once', () => {
  const w = createGridWatcher();
  assert.equal(w.step({ boxes: page(), sig: sig(50), W, H }).state, 'aiming');
  const r = w.step({ boxes: page(4, 3), sig: sig(50), W, H });
  assert.equal(r.state, 'settling');
  assert.equal(r.progress, 1 / GRID.stableLooks);
  assert.equal(w.step({ boxes: page(60, 0), sig: sig(50), W, H }).state, 'aiming', 'moved: start again');
  w.step({ boxes: page(60, 0), sig: sig(50), W, H });
  const fire = w.step({ boxes: page(62, 2), sig: sig(50), W, H });
  assert.deepEqual(fire, { state: 'fire', count: 9, progress: 1 });
  w.captured(sig(50));
  for (let i = 0; i < 5; i++) assert.equal(w.step({ boxes: page(60, 0), sig: sig(51), W, H }).state, 'seen', 'same page: never taken twice');
  // the page is turned: the picture changes, then the new page stays still
  assert.equal(w.step({ boxes: page(60, 0), sig: sig(140), W, H }).state, 'aiming');
  w.step({ boxes: page(60, 0), sig: sig(140), W, H });
  assert.equal(w.step({ boxes: page(60, 0), sig: sig(140), W, H }).state, 'fire');
});

test('fewer than 2 cards: nothing is taken (the single-card camera is for that)', () => {
  const w = createGridWatcher();
  for (let i = 0; i < 4; i++) assert.equal(w.step({ boxes: page(0, 0, 1), sig: sig(50), W, H }).state, 'few');
  assert.equal(w.step({ boxes: [], sig: sig(50), W, H }).state, 'empty');
  w.reset();
  assert.equal(w.step({ boxes: page(0, 0, 4), sig: sig(50), W, H }).count, 4);
});

test('reading order: rows top to bottom, then left to right, even slightly crooked', () => {
  const crooked = page().map((b, i) => ({ ...b, cy: b.cy + (i % 3) * 25 })); // the page leans a bit
  const shuffled = [8, 3, 0, 5, 1, 7, 2, 6, 4].map(i => crooked[i]);
  const order = readingOrder(shuffled).map(i => crooked.indexOf(shuffled[i]));
  assert.deepEqual(order, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(readingOrder([{ cx: 5, cy: 5, h: 10 }]), [0]);
});

test('texts: hint while aiming and the session line', () => {
  assert.match(gridHint('few', 1), /au moins 2/);
  assert.equal(gridHint('settling', 9), '9 cartes · ne bougez plus');
  assert.equal(gridHint('seen'), 'Page prise : tournez la page');
  assert.equal(sessionLine({ pages: 0, cards: 0 }), 'Page 1');
  assert.equal(sessionLine({ pages: 2, cards: 1 }), 'Page 3 · 1 carte ajoutée');
  assert.equal(sessionLine({ pages: 3, cards: 27 }), 'Page 4 · 27 cartes ajoutées');
});
