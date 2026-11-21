// Camera crop of the app (since lot 1.4, yoloDetector._cropCard): the app cuts the card out with
// the same full perspective correction as the bench, on the same corners.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warpQuadRGBA } from '../src/lib/perspectiveCrop.js';

// Minimal canvas for Node: drawImage(canvas, 0, 0), getImageData, putImageData.
class Ctx2D {
  constructor(c) { this.c = c; }
  drawImage(src, x = 0, y = 0) { if (x || y || src.width !== this.c.width || src.height !== this.c.height) throw new Error('shim: copie 1:1 seulement'); this.c.data.set(src.data); }
  getImageData(x, y, w, h) { const out = new Uint8ClampedArray(w * h * 4); for (let r = 0; r < h; r++) out.set(this.c.data.subarray(((y + r) * this.c.width + x) * 4, ((y + r) * this.c.width + x + w) * 4), r * w * 4); return { data: out, width: w, height: h }; }
  putImageData(img) { this.c.data.set(img.data); }
}
class Canvas {
  constructor() { this._w = 0; this._h = 0; this.data = new Uint8ClampedArray(0); }
  set width(v) { this._w = v; this.data = new Uint8ClampedArray(v * this._h * 4); }
  get width() { return this._w; }
  set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * v * 4); }
  get height() { return this._h; }
  getContext() { return new Ctx2D(this); }
}
globalThis.document = { createElement: () => new Canvas(), documentElement: { dataset: {} } };
globalThis.ImageData = class { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } };
globalThis.__BUILD_TIME__ = 'test';
const { default: YOLODetector } = await import('../src/lib/yoloDetector.js');

// A card pattern (rows of distinct greys) seen by a tilted phone: top narrower (0.75), like the series of 15/11.
const pattern = (u, v) => [Math.floor(v * 12) * 20, Math.floor(u * 6) * 40, 128, 255];
function tiltedPhoto() {
  const W = 400; const H = 400;
  const quad = [[140, 80], [260, 80], [300, 330], [100, 330]]; // TL TR BR BL, top 120 px, bottom 200 px
  // homography card (u,v in 0..1) → photo, then inverse sampling
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1[0] - p2[0]; const dx2 = p3[0] - p2[0]; const sx = p0[0] - p1[0] + p2[0] - p3[0];
  const dy1 = p1[1] - p2[1]; const dy2 = p3[1] - p2[1]; const sy = p0[1] - p1[1] + p2[1] - p3[1];
  const den = dx1 * dy2 - dx2 * dy1; const g = (sx * dy2 - dx2 * sy) / den; const h = (dx1 * sy - sx * dy1) / den;
  const a = p1[0] - p0[0] + g * p1[0]; const b = p3[0] - p0[0] + h * p3[0]; const c = p0[0];
  const d = p1[1] - p0[1] + g * p1[1]; const e = p3[1] - p0[1] + h * p3[1]; const f = p0[1];
  const rgba = new Uint8ClampedArray(W * H * 4).fill(60);
  // forward-map a fine grid of the card (dense enough to fill every pixel)
  for (let j = 0; j <= 1000; j++) for (let i = 0; i <= 600; i++) {
    const u = i / 600; const v = j / 1000; const z = g * u + h * v + 1;
    const x = Math.round((a * u + b * v + c) / z); const y = Math.round((d * u + e * v + f) / z);
    if (x >= 0 && y >= 0 && x < W && y < H) rgba.set(pattern(Math.min(u, 0.999), Math.min(v, 0.999)), (y * W + x) * 4);
  }
  return { rgba, W, H, quad };
}

test('camera crop = bench crop (same corners, same pixels)', () => {
  const { rgba, W, H, quad } = tiltedPhoto();
  const frame = new Canvas(); frame.width = W; frame.height = H; frame.data.set(rgba);
  const det = Object.create(YOLODetector.prototype);
  const app = det._cropCard(frame, quad);                 // what the app identifies
  const bench = warpQuadRGBA(rgba, W, H, quad);           // what eval-detector / eval-recognition identify
  assert.equal(app.width, bench.w); assert.equal(app.height, bench.h);
  assert.deepEqual(app.data, bench.data);
  assert.equal(YOLODetector.prototype._cropPerspective, undefined, 'one crop: the former strips are gone');
});

test('full perspective puts each row of a tilted card back in place', () => {
  const { rgba, W, H, quad } = tiltedPhoto();
  const { data, w, h } = warpQuadRGBA(rgba, W, H, quad);
  // the 12 grey bands of the card: each crop row must show the band of its height (perspective corrected)
  let bad = 0; let n = 0;
  for (let y = 2; y < h - 2; y++) {
    const want = Math.floor((y + 0.5) / h * 12) * 20;
    const got = data[(y * w + Math.floor(w / 2)) * 4];
    if (Math.abs(got - want) > 20) bad++;
    n++;
  }
  assert.ok(bad / n < 0.05, `rangées mal placées : ${bad}/${n}`);
});
