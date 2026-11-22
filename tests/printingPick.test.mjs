// Printing pick (phase C, adapted from OpenRift — AGPL-3.0).
import test from 'node:test';
import assert from 'node:assert/strict';
import { printingSignature, discriminativeMargin, resolvePrinting, unanimousPick, printingIdentity } from '../src/lib/printingPick.js';

/** A 480 × 670 card: textured, with a « code » drawn at the bottom left (bars of `digits`). */
function card(digits, seed = 1) {
  const w = 480; const h = 670;
  const rgba = new Uint8ClampedArray(w * h * 4);
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < w * h; i++) { const v = 60 + Math.floor(rnd() * 40); rgba.set([v, v, v, 255], i * 4); }
  // code strip: x 0.03–0.34, y 0.935–0.985
  digits.forEach((d, k) => {
    for (let y = Math.round(h * 0.945); y < Math.round(h * 0.975); y++) {
      for (let x = 0; x < 6 + d * 2; x++) {
        const px = Math.round(w * 0.04) + k * 14 + x;
        rgba.set([240, 240, 240, 255], (y * w + px) * 4);
      }
    }
  });
  return { rgba, w, h };
}

test('bands: name, code and stamp of a portrait card; none for a landscape one', () => {
  const c = card([1, 2, 3]);
  const sig = printingSignature(c.rgba, c.w, c.h, 'rune');
  assert.equal(sig.code.width, 96);
  assert.equal(sig.stamp.width, 48);
  assert.equal(printingSignature(c.rgba, 670, 480, 'rune'), null);
});

test('margin: only where the two printings differ', () => {
  const a = printingSignature(...Object.values(card([1, 2, 3])), 'rune').code;
  const b = printingSignature(...Object.values(card([3, 1, 2])), 'rune').code;
  assert.ok(discriminativeMargin(a, a, b) > 0.3);
  assert.ok(discriminativeMargin(a, b, a) < -0.3);
  assert.equal(discriminativeMargin(a, a, a), null); // the same picture: no evidence
});

test('pick: the code strip separates two printings; same picture with two codes stays the user’s choice', () => {
  const A = card([1, 2, 3]); const B = card([3, 1, 2]);
  const sig = (c) => printingSignature(c.rgba, c.w, c.h, 'rune');
  const ids = { a: { code: 'OGN-1', markers: '', language: 'en' }, b: { code: 'RAD-1', markers: '', language: 'en' }, c: { code: 'UNL-1', markers: '', language: 'en' } };
  const identityOf = (k) => ids[k];
  const pick = resolvePrinting(sig(A), new Map([['a', sig(A)], ['b', sig(B)]]), identityOf);
  assert.equal(pick?.key, 'a');
  assert.equal(pick.via, 'code');
  // b and c: the same picture, different codes → not unanimous
  const twin = resolvePrinting(sig(B), new Map([['a', sig(A)], ['b', sig(B)], ['c', sig(B)]]), identityOf);
  assert.equal(unanimousPick(twin, identityOf), false);
});

test('identity: promos and stamped printings are « marked »', () => {
  assert.equal(printingIdentity({ code: 'OGN-1' }).markers, '');
  assert.equal(printingIdentity({ code: 'OGN-1', printLabel: 'Organized Play' }).markers, 'promo');
});
