// Pixel check and outline snapping (phase A, adapted from OpenRift — AGPL-3.0).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALIGNED_WIDTH, ALIGNED_HEIGHT, alignedSignature, alignedScore, pickAlignedWinner, alignedFrameWeight,
  downscaleGray, focusScore, encodeSignature, decodeSignature, upperMedian, DEFAULT_ALIGNED_OPTIONS,
} from '../src/lib/alignedVerify.js';
import { snapQuadToEdges } from '../src/lib/edgeSnap.js';

const N = ALIGNED_WIDTH * ALIGNED_HEIGHT;
/** Deterministic textured RGBA picture (w × h), `seed` changes the pattern. */
function picture(w, h, seed = 1) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const blobs = Array.from({ length: 40 }, () => ({ x: rnd() * w, y: rnd() * h, r: 10 + rnd() * 60, v: rnd() * 255 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 60;
      for (const b of blobs) if ((x - b.x) ** 2 + (y - b.y) ** 2 < b.r * b.r) v = b.v;
      const p = (y * w + x) * 4;
      rgba[p] = v; rgba[p + 1] = v; rgba[p + 2] = v; rgba[p + 3] = 255;
    }
  }
  return rgba;
}

test('signature: 40 × 56 grey, area average; landscape turned to portrait', () => {
  const sig = alignedSignature(picture(480, 670), 480, 670);
  assert.equal(sig.length, N);
  const land = alignedSignature(picture(670, 480), 670, 480);
  assert.equal(land.length, N);
  const g = downscaleGray({ data: Uint8Array.from([0, 100, 200, 100]), width: 2, height: 2 }, 1, 1);
  assert.equal(g.data[0], 100);
  assert.equal(upperMedian([3, 1, 2, 4]), 3);
});

test('score: the same picture ≈ 1, another picture much lower, a flat picture undefined', () => {
  const a = alignedSignature(picture(480, 670, 1), 480, 670);
  const b = alignedSignature(picture(480, 670, 7), 480, 670);
  assert.ok(alignedScore(a, a) > 0.99);
  assert.ok(alignedScore(a, b) < 0.6, `other picture: ${alignedScore(a, b)}`);
  assert.ok(Number.isNaN(alignedScore(new Uint8Array(N).fill(128), a)));
});

test('score: an outline 1 % off and a glare still match (±2 px shift, median)', () => {
  const w = 480; const h = 670;
  const src = picture(w + 10, h + 10, 3);
  const crop = (ox, oy) => { const out = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) out.set(src.subarray(((y + oy) * (w + 10) + ox) * 4, ((y + oy) * (w + 10) + ox + w) * 4), y * w * 4); return out; };
  const ref = alignedSignature(crop(0, 0), w, h);
  const shifted = crop(6, 6);
  for (let y = 0; y < 150; y++) for (let x = 0; x < 150; x++) { const p = (y * w + x) * 4; shifted[p] = shifted[p + 1] = shifted[p + 2] = 255; }
  assert.ok(alignedScore(alignedSignature(shifted, w, h), ref) > 0.8);
});

test('score: upside down, only the 180° signature matches', () => {
  const rgba = picture(480, 670, 5);
  const ref = alignedSignature(rgba, 480, 670);
  const flipped = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) flipped.set(rgba.subarray(i, i + 4), rgba.length - 4 - i);
  assert.ok(alignedScore(alignedSignature(flipped, 480, 670, 2), ref) > 0.99);
  assert.ok(alignedScore(alignedSignature(flipped, 480, 670, 0), ref) < 0.6);
});

test('decision: under 0.60 nothing; within 0.15 of another artwork refused; reprints are not rivals', () => {
  const art = (k) => k.split(':')[0];
  assert.deepEqual(pickAlignedWinner([{ key: 'a:1', score: 0.55 }], art).winner, null);
  const refused = pickAlignedWinner([{ key: 'a:1', score: 0.8 }, { key: 'b:1', score: 0.7 }], art);
  assert.equal(refused.winner, null);
  assert.equal(refused.refused, true);
  const reprint = pickAlignedWinner([{ key: 'a:1', score: 0.8 }, { key: 'a:2', score: 0.79 }, { key: 'b:1', score: 0.5 }], art);
  assert.equal(reprint.winner.key, 'a:1');
  assert.ok(Math.abs(reprint.winner.rival - 0.5) < 1e-9);
  assert.equal(pickAlignedWinner([{ key: 'a:1', score: NaN }, { key: 'b:1', score: 0.9 }], art).winner.key, 'b:1');
});

test('frame weight: 1 at the threshold, 2 from 0.95', () => {
  assert.equal(alignedFrameWeight({ score: 0.6 }), 1);
  assert.equal(alignedFrameWeight({ score: 0.99 }), 2);
  assert.ok(Math.abs(alignedFrameWeight({ score: 0.775 }, DEFAULT_ALIGNED_OPTIONS) - 1.5) < 1e-9);
});

test('focus: a sharp picture scores much higher than a flat one', () => {
  const g = { data: new Uint8Array(100 * 100), width: 100, height: 100 };
  assert.equal(focusScore(g), 0);
  for (let i = 0; i < g.data.length; i++) g.data[i] = (i % 2) * 200;
  assert.ok(focusScore(g) > 1000);
});

test('signature storage: base64 and back', () => {
  const sig = alignedSignature(picture(480, 670, 9), 480, 670);
  assert.deepEqual(decodeSignature(encodeSignature(sig)), sig);
  assert.equal(decodeSignature('abc'), null);
});

test('outline: corners a few px off snap back onto the card edges', () => {
  const w = 400; const h = 500;
  const data = new Uint8Array(w * h).fill(30);
  const card = { x0: 100, y0: 80, x1: 300, y1: 360 };
  for (let y = card.y0; y < card.y1; y++) for (let x = card.x0; x < card.x1; x++) data[y * w + x] = 220;
  const coarse = [[103, 84], [297, 78], [304, 357], [96, 363]];
  const snapped = snapQuadToEdges({ data, width: w, height: h }, coarse);
  const want = [[card.x0, card.y0], [card.x1, card.y0], [card.x1, card.y1], [card.x0, card.y1]];
  snapped.forEach(([x, y], i) => {
    assert.ok(Math.hypot(x - want[i][0], y - want[i][1]) < 1.5, `corner ${i}: ${x.toFixed(1)}, ${y.toFixed(1)}`);
  });
  // nothing to snap to (flat picture): the outline is kept
  assert.deepEqual(snapQuadToEdges({ data: new Uint8Array(w * h), width: w, height: h }, coarse), coarse);
});
