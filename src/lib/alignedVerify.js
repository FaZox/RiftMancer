// Adapted from OpenRift packages/shared/src/scan/aligned-verify.ts, accept.ts and image.ts (AGPL-3.0)
// https://github.com/openriftapp/openrift, commit fb7f633c — Copyright Eiko Wagenknecht.
/**
 * Pixel check of a straightened card (REPRODUIRE-SCANNER-OPENRIFT.md, phase A).
 *
 * The recognition engines (colours, AI) only PROPOSE a short list of cards;
 * the decision is taken here by comparing pixels with each candidate's own
 * picture: both are reduced to a 40 × 56 grey thumbnail, cut into 10 × 10
 * patches (step 5), and each patch keeps its best normalised correlation within
 * ±2 px (small outline errors). The score is the median of the patches, so a
 * finger or a glare on part of the card does not sink a right match; flat
 * patches (plain borders, blown-out glare) are left out.
 * A weaker engine thus costs cards not found, never a wrong card.
 *
 * Pure functions on RGBA / grey arrays: same code in the app (browser, phone)
 * and in the benches (Node).
 */

export const ALIGNED_WIDTH = 40;
export const ALIGNED_HEIGHT = 56;
const PATCH = 10;
const STRIDE = 5;
/** Thumbnail pixels. */
const SHIFT = 2;
/** Grey levels squared. */
const MIN_PIXEL_VARIANCE = 4;
const MIN_TEXTURED_PATCH_SHARE = 1 / 3;

/** OpenRift's thresholds (Prudent): best ≥ 0.60, 0.15 ahead of any other artwork. */
export const DEFAULT_ALIGNED_OPTIONS = { minScore: 0.6, minMargin: 0.15 };
const ALIGNED_FULL_WEIGHT_SCORE = 0.95;
export const MAX_FRAME_WEIGHT = 2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function upperMedian(values) {
  if (!values.length) return undefined;
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

/** ITU-R BT.601 weights in 8-bit fixed point. */
export const luma = (r, g, b) => (r * 77 + g * 150 + b * 29) >> 8;

/** RGBA → grey (Uint8Array). */
export function toGray(rgba, w, h) {
  const out = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = luma(rgba[p], rgba[p + 1], rgba[p + 2]);
  return { data: out, width: w, height: h };
}

/**
 * Area-average downscale: every source pixel counts in exactly one destination
 * cell, which avoids the aliasing nearest-neighbour would add.
 */
export function downscaleGray(src, dstW, dstH) {
  if (dstW === src.width && dstH === src.height) return { data: Uint8Array.from(src.data), width: dstW, height: dstH };
  const sums = new Float64Array(dstW * dstH);
  const counts = new Uint32Array(dstW * dstH);
  const xMap = new Uint32Array(src.width);
  for (let x = 0; x < src.width; x++) xMap[x] = Math.min(dstW - 1, Math.floor((x * dstW) / src.width));
  for (let y = 0; y < src.height; y++) {
    const dy = Math.min(dstH - 1, Math.floor((y * dstH) / src.height));
    const srcRow = y * src.width;
    const dstRow = dy * dstW;
    for (let x = 0; x < src.width; x++) {
      const idx = dstRow + xMap[x];
      sums[idx] += src.data[srcRow + x];
      counts[idx]++;
    }
  }
  const out = new Uint8Array(dstW * dstH);
  for (let i = 0; i < out.length; i++) out[i] = counts[i] === 0 ? 0 : Math.round(sums[i] / counts[i]);
  return { data: out, width: dstW, height: dstH };
}

/** Variance of the Laplacian: higher means sharper, near zero for a blurred frame. */
export function focusScore(gray) {
  const { data, width: w, height: h } = gray;
  if (w < 3 || h < 3) return 0;
  let sum = 0; let sumSq = 0; let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w];
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Grey image turned by 180° (a card held upside down). */
function rotate180(gray) {
  const out = new Uint8Array(gray.data.length);
  for (let i = 0, j = out.length - 1; i < out.length; i++, j--) out[i] = gray.data[j];
  return { data: out, width: gray.width, height: gray.height };
}

/** Grey image turned by 90° to the left (a landscape picture, battlefields). */
function rotateLeft(gray) {
  const { data, width: w, height: h } = gray;
  const out = new Uint8Array(w * h);
  // new image: width h, height w; (x, y) → (y, w - 1 - x)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[(w - 1 - x) * h + y] = data[y * w + x];
  return { data: out, width: h, height: w };
}

/**
 * 40 × 56 signature (Uint8Array) of a picture: grey, portrait (landscape is
 * turned 90° to the left, like the stored cards), `rotation` 2 = upside down.
 */
export function alignedSignature(rgba, w, h, rotation = 0) {
  let gray = toGray(rgba, w, h);
  if (gray.width > gray.height) gray = rotateLeft(gray);
  if (rotation % 4 === 2) gray = rotate180(gray);
  return downscaleGray(gray, ALIGNED_WIDTH, ALIGNED_HEIGHT).data;
}

function patchCorrelation(q, r, x, y, dx, dy) {
  const W = ALIGNED_WIDTH; const H = ALIGNED_HEIGHT;
  let sumQ = 0; let sumR = 0; let sumQQ = 0; let sumRR = 0; let sumQR = 0;
  const n = PATCH * PATCH;
  for (let py = 0; py < PATCH; py++) {
    const ry = y + py;
    const qy = clamp(ry + dy, 0, H - 1);
    for (let px = 0; px < PATCH; px++) {
      const rx = x + px;
      const qx = clamp(rx + dx, 0, W - 1);
      const a = q[qy * W + qx];
      const b = r[ry * W + rx];
      sumQ += a; sumR += b; sumQQ += a * a; sumRR += b * b; sumQR += a * b;
    }
  }
  const varQ = sumQQ - (sumQ * sumQ) / n;
  const varR = sumRR - (sumR * sumR) / n;
  // Flat patches (plain borders, blown-out glare) carry no evidence either way.
  if (varQ < n * MIN_PIXEL_VARIANCE || varR < n * MIN_PIXEL_VARIANCE) return NaN;
  return (sumQR - (sumQ * sumR) / n) / Math.sqrt(varQ * varR);
}

/** Median over the patches of the best correlation within ±2 px; NaN when the picture has too little texture. */
export function alignedScore(query, reference) {
  const scores = [];
  let patches = 0;
  for (let y = 0; y + PATCH <= ALIGNED_HEIGHT; y += STRIDE) {
    for (let x = 0; x + PATCH <= ALIGNED_WIDTH; x += STRIDE) {
      patches++;
      let best = -Infinity;
      for (let dy = -SHIFT; dy <= SHIFT; dy++) {
        for (let dx = -SHIFT; dx <= SHIFT; dx++) {
          const s = patchCorrelation(query, reference, x, y, dx, dy);
          if (s > best) best = s;
        }
      }
      if (Number.isFinite(best)) scores.push(best);
    }
  }
  if (scores.length < patches * MIN_TEXTURED_PATCH_SHARE) return NaN;
  return upperMedian(scores) ?? NaN;
}

/**
 * Decision on one picture from the scores of its short list
 * (`scores`: [{ key, score }], `artOf(key)`: its artwork — reprints of the same
 * artwork are not rivals). → { winner: { key, art, score, rival } | null, refused }:
 * no winner when the best is under minScore; refused (the user is asked) when
 * another artwork is closer than minMargin.
 */
export function pickAlignedWinner(scores, artOf, options = DEFAULT_ALIGNED_OPTIONS) {
  let best = null;
  for (const e of scores) if (Number.isFinite(e.score) && (!best || e.score > best.score)) best = e;
  if (!best || best.score < options.minScore) return { winner: null, refused: false, best };
  const art = artOf(best.key);
  let rival = -Infinity;
  for (const e of scores) if (Number.isFinite(e.score) && artOf(e.key) !== art) rival = Math.max(rival, e.score);
  if (best.score - rival < options.minMargin) return { winner: null, refused: true, best, rival };
  return { winner: { key: best.key, art, score: best.score, rival: Number.isFinite(rival) ? rival : 0 }, refused: false };
}

/** Weight of a winning picture for the multi-picture lock (phase B): 1 to 2. */
export function alignedFrameWeight(winner, options = DEFAULT_ALIGNED_OPTIONS) {
  const strength = (winner.score - options.minScore) / (ALIGNED_FULL_WEIGHT_SCORE - options.minScore);
  return 1 + (MAX_FRAME_WEIGHT - 1) * clamp(strength, 0, 1);
}

// ─── Storage of the reference signatures (catalog, content layers) ─────────
/** Uint8Array(2240) → base64. */
export function encodeSignature(sig) {
  let s = '';
  for (let i = 0; i < sig.length; i++) s += String.fromCharCode(sig[i]);
  return btoa(s);
}
/** base64 → Uint8Array(2240), or null. */
export function decodeSignature(text) {
  if (typeof text !== 'string' || !text) return null;
  const bin = atob(text);
  if (bin.length !== ALIGNED_WIDTH * ALIGNED_HEIGHT) return null;
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
