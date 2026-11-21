/**
 * Card fingerprint (« empreinte ») — pure JavaScript, no DOM, so the browser,
 * the Android app and the Node test bench (scripts/eval-matcher.mjs) compute
 * EXACTLY the same features.
 *
 * Same recipe as the catalog (model/cards_scraper.py):
 *   1. crop the artwork: x 5–95 %, y 5 % → artBottom (0.55 / 0.85 / 0.95)
 *   2. per-channel histogram equalisation (cv2.equalizeHist)
 *   3. area-average downsampling to a 16×16 grid (cv2.INTER_AREA)
 *   → 16 × 16 × 3 values in 0–1.
 */

export const ART_TOP = 0.05;
export const ART_LEFT = 0.05;
export const ART_RIGHT = 0.95;
export const ART_BOTTOM_DEFAULT = 0.55;

/**
 * @param {Uint8Array|Uint8ClampedArray} rgba  w × h × 4 pixels
 * @returns {Float32Array} grid × grid × 3 features (0–1)
 */
export function gridFeatures(rgba, w, h, bottom = ART_BOTTOM_DEFAULT, grid = 16) {
  const sx = Math.round(w * ART_LEFT);
  const sy = Math.round(h * ART_TOP);
  const sw = Math.max(1, Math.round(w * ART_RIGHT) - sx);
  const sh = Math.max(1, Math.round(h * bottom) - sy);

  // 1–2. Histogram equalisation over the artwork region (one LUT per channel).
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let y = sy; y < sy + sh; y++) {
    let p = (y * w + sx) * 4;
    for (let x = 0; x < sw; x++, p += 4) {
      hist[0][rgba[p]]++;
      hist[1][rgba[p + 1]]++;
      hist[2][rgba[p + 2]]++;
    }
  }
  const total = sw * sh;
  const lut = hist.map(hc => {
    const l = new Uint8Array(256);
    let cdf = 0;
    let cdfMin = -1;
    for (let i = 0; i < 256; i++) {
      cdf += hc[i];
      if (cdfMin < 0 && cdf > 0) cdfMin = cdf;
      const denom = total - cdfMin;
      l[i] = denom > 0 ? Math.max(0, Math.min(255, Math.round(((cdf - cdfMin) * 255) / denom))) : i;
    }
    return l;
  });

  // 3. Area averaging, separable (same weights as cv2.INTER_AREA): each row is
  //    first summed into the grid columns, then the row spreads over at most
  //    two grid rows. Each source pixel spreads over at most two cells per axis.
  const lr = lut[0];
  const lg = lut[1];
  const lb = lut[2];
  const xs = splitAxis(sw, grid);
  const ys = splitAxis(sh, grid);
  const xc0 = new Int32Array(sw);
  const xw0 = new Float64Array(sw);
  const xc1 = new Int32Array(sw);
  const xw1 = new Float64Array(sw);
  for (let x = 0; x < sw; x++) {
    const [c0, w0, c1, w1] = xs[x];
    xc0[x] = c0 * 3; xw0[x] = w0; xc1[x] = c1 * 3; xw1[x] = w1;
  }
  const g3 = grid * 3;
  const row = new Float64Array(g3);
  const acc = new Float64Array(grid * g3);
  for (let y = 0; y < sh; y++) {
    row.fill(0);
    let p = ((sy + y) * w + sx) * 4;
    for (let x = 0; x < sw; x++, p += 4) {
      const r = lr[rgba[p]];
      const g = lg[rgba[p + 1]];
      const bl = lb[rgba[p + 2]];
      let k = xc0[x];
      let wt = xw0[x];
      row[k] += wt * r; row[k + 1] += wt * g; row[k + 2] += wt * bl;
      wt = xw1[x];
      if (wt) {
        k = xc1[x];
        row[k] += wt * r; row[k + 1] += wt * g; row[k + 2] += wt * bl;
      }
    }
    const [cy0, wy0, cy1, wy1] = ys[y];
    const o0 = cy0 * g3;
    for (let i = 0; i < g3; i++) acc[o0 + i] += wy0 * row[i];
    if (wy1) {
      const o1 = cy1 * g3;
      for (let i = 0; i < g3; i++) acc[o1 + i] += wy1 * row[i];
    }
  }
  const cellArea = (sw / grid) * (sh / grid);
  const out = new Float32Array(grid * grid * 3);
  for (let i = 0; i < out.length; i++) out[i] = acc[i] / cellArea / 255;
  return out;
}

/** For each source index: [cell0, weight0, cell1, weight1] (weights in source-pixel units). */
function splitAxis(n, grid) {
  const out = new Array(n);
  const scale = grid / n; // cells per source pixel
  for (let i = 0; i < n; i++) {
    const a = i * scale;
    const b = (i + 1) * scale;
    const c0 = Math.min(grid - 1, Math.floor(a));
    const edge = c0 + 1;
    if (b <= edge + 1e-9 || c0 === grid - 1) out[i] = [c0, 1, 0, 0];
    else {
      const w0 = (edge - a) / scale;
      out[i] = [c0, w0, c0 + 1, 1 - w0];
    }
  }
  return out;
}

// ─── Orientations (the matcher tests several, see matchIndex.js) ─────────
export function flipH(rgba, w, h) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = (y * w + (w - 1 - x)) * 4;
      out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
    }
  }
  return out;
}

export function rotate180(rgba) {
  const out = new Uint8ClampedArray(rgba.length);
  const n = rgba.length / 4;
  for (let i = 0; i < n; i++) {
    const s = i * 4;
    const d = (n - 1 - i) * 4;
    out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
  }
  return out;
}

/** 90° clockwise; the result is h × w. */
export function rotate90(rgba, w, h) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const nx = h - 1 - y;
      const ny = x;
      const d = (ny * h + nx) * 4;
      out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
    }
  }
  return out;
}

/**
 * Query features for every orientation tested and every crop bottom used by
 * the catalog: [{ name, byBottom: Map(bottom → Float32Array) }].
 *   normal, flip (mirrored photo), rot180 (card upside down / battlefields),
 *   rot90 (landscape crop).
 */
export function queryViews(rgba, w, h, bottoms, grid = 16) {
  const views = [
    { name: 'normal', data: rgba, w, h },
    { name: 'flip', data: flipH(rgba, w, h), w, h },
    { name: 'rot180', data: rotate180(rgba), w, h },
    { name: 'rot90', data: rotate90(rgba, w, h), w: h, h: w },
  ];
  return views.map(v => ({
    name: v.name,
    byBottom: new Map(bottoms.map(b => [b, gridFeatures(v.data, v.w, v.h, b, grid)])),
  }));
}
