// Lot 8.1: hands-free scan — a new card put down and still triggers one scan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandsFree, changedShare, HF } from '../src/lib/handsFree.js';

const W = 64, H = 48;
/** A table (grey 60) with, optionally, a card (bright rectangle) and some sensor noise. */
function frame({ card = null, noise = 0, shift = 0 } = {}) {
  const data = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 60;
      if (card && x >= card.x + shift && x < card.x + shift + 16 && y >= 12 && y < 34) v = card.v;
      v += noise ? Math.round(Math.sin((x * 7 + y * 13) * noise) * 2) : 0;
      data[y * W + x] = v;
    }
  }
  return { data, w: W, h: H };
}
const run = (hf, frames) => frames.map(f => hf.step(f).state);

test('a card put down fires once it has been still for 3 looks, then waits', () => {
  const hf = createHandsFree();
  const empty = frame();
  // the empty table is seen first (nothing scanned yet: it fires, the scan finds no card)
  assert.deepEqual(run(hf, [empty, empty, empty, empty]), ['moving', 'settling', 'settling', 'fire']);
  hf.scanned(empty);
  assert.deepEqual(run(hf, [empty, empty]), ['waiting', 'waiting']);
  // a card slides in, then stops
  const states = run(hf, [frame({ card: { x: 10, v: 200 }, shift: 8 }), frame({ card: { x: 10, v: 200 }, shift: 3 }),
    frame({ card: { x: 10, v: 200 } }), frame({ card: { x: 10, v: 200 } }), frame({ card: { x: 10, v: 200 } }), frame({ card: { x: 10, v: 200 } })]);
  assert.deepEqual(states, ['moving', 'moving', 'moving', 'settling', 'settling', 'fire']);
  hf.scanned(frame({ card: { x: 10, v: 200 } }));
  // left on the table: never scanned again, even with sensor noise
  assert.deepEqual(run(hf, Array.from({ length: 6 }, (_, i) => frame({ card: { x: 10, v: 200 }, noise: 0.3 + i }))), Array(6).fill('waiting'));
});

test('another card at the same place is new; the progress fills the ring', () => {
  const hf = createHandsFree();
  const a = frame({ card: { x: 20, v: 200 } });
  run(hf, [a, a, a, a]);
  hf.scanned(a);
  const b = frame({ card: { x: 20, v: 120 } });
  const r = [hf.step(b), hf.step(b), hf.step(b), hf.step(b)];
  assert.deepEqual(r.map(x => x.state), ['moving', 'settling', 'settling', 'fire']);
  assert.deepEqual(r.map(x => Math.round(x.progress * 100)), [0, 33, 67, 100]);
});

test('changedShare: the share of cells that changed', () => {
  const a = frame(), b = frame({ card: { x: 0, v: 200 } });
  assert.equal(changedShare(a, a), 0);
  assert.equal(Math.round(changedShare(a, b) * 1000) / 1000, Math.round(((16 * 22) / (W * H)) * 1000) / 1000);
  assert.ok(changedShare(a, b) > HF.changeShare);
});
