// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
/* Auto scan: corners reused only while the same card stays still (cornerCache). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CornerCache, graySignature, MAX_REUSE } from '../src/lib/cornerCache.js';
import { NO_LFS } from './helpers.mjs';

const W = 640;
const H = 480;
const CW = 240;
const CH = 335;
const file = (p) => fileURLToPath(new URL(p, import.meta.url));

/** Camera frame: a card at (x, y) on a plain table, optional noise / exposure. */
async function frame(card, x, y, { noise = 0, gain = 1 } = {}) {
  const layers = card ? [{ input: await sharp(file(`../public/cards/${card}.webp`)).resize(CW, CH, { fit: 'fill' }).png().toBuffer(), left: x, top: y }] : [];
  const { data } = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 120, g: 110, b: 100, alpha: 1 } } })
    .composite(layers).raw().toBuffer({ resolveWithObject: true });
  let seed = 7;
  for (let i = 0; i < data.length; i++) {
    if (i % 4 === 3) continue;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = Math.max(0, Math.min(255, data[i] * gain + (noise ? ((seed % 1000) / 500 - 1) * noise : 0)));
  }
  return graySignature(data, W, H);
}
const kps = (x, y) => [[x, y], [x + CW, y], [x + CW, y + CH], [x, y + CH]];

const A = 'ogn-001-298';
const B = 'ogn-002-298';
const first = NO_LFS ? null : await frame(A, 200, 70);
const stored = () => {
  const c = new CornerCache();
  c.store(first, kps(200, 70), W, H, A);
  return c;
};

test('still picture (sensor noise, slight exposure change) → the corners are reused', { skip: NO_LFS }, async () => {
  const c = stored();
  assert.deepEqual(c.reuse(await frame(A, 200, 70, { noise: 20 }), W, H)?.kps, kps(200, 70));
  assert.ok(c.reuse(await frame(A, 200, 70, { gain: 1.04 }), W, H));
  assert.equal(c.acceptReused(A), true);
});

test('another card put at the same place → YOLO again', { skip: NO_LFS }, async () => {
  assert.equal(stored().reuse(await frame(B, 200, 70), W, H), null);
});

test('card taken away, framing moved → YOLO again', { skip: NO_LFS }, async () => {
  assert.equal(stored().reuse(await frame(null, 0, 0), W, H), null);
  assert.equal(stored().reuse(await frame(A, 215, 70), W, H), null);
  assert.equal(stored().reuse(await frame(A, 200, 70), W + 2, H), null); // other frame size
});

test('slow drift: compared with the frame the corners were measured on, not the previous one', { skip: NO_LFS }, async () => {
  const c = stored();
  let reused = 0;
  for (let dx = 2; dx <= 20; dx += 2) if (c.reuse(await frame(A, 200 + dx, 70), W, H)) reused++;
  assert.ok(reused < 4, `${reused} réutilisations pendant une dérive de 20 px`);
});

test(`at most ${MAX_REUSE} reuses in a row, then YOLO`, { skip: NO_LFS }, async () => {
  const c = stored();
  const same = await frame(A, 200, 70, { noise: 5 });
  for (let k = 0; k < MAX_REUSE; k++) assert.ok(c.reuse(same, W, H));
  assert.equal(c.reuse(same, W, H), null);
});

test('reused corners giving another card (or none) → rejected, cache emptied', { skip: NO_LFS }, async () => {
  const c = stored();
  assert.ok(c.reuse(first, W, H));
  assert.equal(c.acceptReused(B), false);
  assert.equal(c.reuse(first, W, H), null);
  const d = stored();
  assert.ok(d.reuse(first, W, H));
  assert.equal(d.acceptReused(null), false);
  assert.equal(d.reuse(first, W, H), null);
});

test('corners found while the card was not recognised: the next recognition is accepted', { skip: NO_LFS }, async () => {
  const c = new CornerCache();
  c.store(first, kps(200, 70), W, H, null);
  assert.ok(c.reuse(first, W, H));
  assert.equal(c.acceptReused(A), true);
  assert.ok(c.reuse(first, W, H));
  assert.equal(c.acceptReused(B), false); // now bound to A
});
