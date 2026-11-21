/**
 * Auto scan: reuse the card's corners while the picture does not move
 * (AMELIORATIONS-NATIF.md, before step 2). The detector (YOLO, ≈ 0.5 s on
 * the phone) only runs again when the card or the framing changes.
 *
 * Pure (no DOM) except frameSignature: graySignature takes RGBA pixels, any
 * size (a few thousand pixels are enough — SIG_W × SIG_H cells).
 *
 * Never the corners of a previous card:
 *   - the whole picture must be still (mean difference ≤ FRAME_DIFF), AND the
 *     card's own area too (≤ CARD_DIFF, stricter): another card put at the
 *     same place changes that area;
 *   - the reused corners are compared with the frame they were measured on,
 *     not with the previous frame (no slow drift accepted step by step);
 *   - at most MAX_REUSE scans in a row, then the detector runs again;
 *   - the caller rejects a reused result whose card is not the one found
 *     with these corners (acceptReused), and runs the detector at once.
 */

export const SIG_W = 64;
export const SIG_H = 48;
export const FRAME_DIFF = 6;   // mean |Δ| of the grey levels (0–255), whole picture
export const CARD_DIFF = 8;    // same, inside the card's box
export const MAX_REUSE = 5;    // then the detector runs again

/** Grey levels (Rec. 601) of an RGBA picture, averaged into outW × outH cells. */
export function graySignature(rgba, w, h, outW = SIG_W, outH = SIG_H) {
  const sum = new Float64Array(outW * outH);
  const count = new Uint32Array(outW * outH);
  for (let y = 0; y < h; y++) {
    const row = Math.min(outH - 1, Math.floor((y * outH) / h)) * outW;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = row + Math.min(outW - 1, Math.floor((x * outW) / w));
      sum[c] += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      count[c]++;
    }
  }
  const out = new Uint8Array(outW * outH);
  for (let c = 0; c < out.length; c++) out[c] = count[c] ? Math.round(sum[c] / count[c]) : 0;
  return { data: out, w: outW, h: outH };
}

/** Cells of the signature covered by the bounding box of the corners (frame of srcW × srcH). */
export function cardMask(kps, srcW, srcH, sig) {
  const xs = kps.map(p => p[0]);
  const ys = kps.map(p => p[1]);
  const x0 = Math.max(0, Math.floor((Math.min(...xs) / srcW) * sig.w));
  const x1 = Math.min(sig.w - 1, Math.ceil((Math.max(...xs) / srcW) * sig.w));
  const y0 = Math.max(0, Math.floor((Math.min(...ys) / srcH) * sig.h));
  const y1 = Math.min(sig.h - 1, Math.ceil((Math.max(...ys) / srcH) * sig.h));
  const cells = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.push(y * sig.w + x);
  return cells;
}

/** Mean absolute difference of two signatures (all cells, or only `cells`). */
export function meanDiff(a, b, cells = null) {
  if (!a || !b || a.w !== b.w || a.h !== b.h) return Infinity;
  let s = 0;
  if (cells) {
    if (!cells.length) return Infinity;
    for (const c of cells) s += Math.abs(a.data[c] - b.data[c]);
    return s / cells.length;
  }
  for (let c = 0; c < a.data.length; c++) s += Math.abs(a.data[c] - b.data[c]);
  return s / a.data.length;
}

/**
 * Grey signature of a camera frame (browser only — the rest of this file is
 * pure): the canvas shrinks it
 * (4 × the signature, smoothed) and the average of each cell is taken in JS —
 * ≈ 1 ms, instead of ≈ 70 ms on the full frame.
 */
let sigCanvas = null;
export function frameSignature(frame) {
  if (!sigCanvas) sigCanvas = document.createElement('canvas');
  const w = SIG_W * 4;
  const h = SIG_H * 4;
  sigCanvas.width = w;
  sigCanvas.height = h;
  const ctx = sigCanvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(frame, 0, 0, w, h);
  return graySignature(ctx.getImageData(0, 0, w, h).data, w, h);
}

export class CornerCache {
  constructor() {
    this.clear();
  }

  clear() {
    this.entry = null; // { sig, kps, srcW, srcH, cells, cardId, reuses }
  }

  /** After a detector run: the corners of the card, on the frame `sig` (srcW × srcH). */
  store(sig, kps, srcW, srcH, cardId = null) {
    this.entry = { sig, kps, srcW, srcH, cells: cardMask(kps, srcW, srcH, sig), cardId, reuses: 0 };
  }

  /** The card found with the stored corners (null: not recognised). */
  setCard(cardId) {
    if (this.entry) this.entry.cardId = cardId;
  }

  /**
   * Corners to reuse for this frame, or null (→ run the detector).
   * @returns {{ kps, cardId } | null}
   */
  reuse(sig, srcW, srcH) {
    const e = this.entry;
    if (!e) return null;
    if (srcW !== e.srcW || srcH !== e.srcH || e.reuses >= MAX_REUSE) return null;
    if (meanDiff(sig, e.sig) > FRAME_DIFF) return null;
    if (meanDiff(sig, e.sig, e.cells) > CARD_DIFF) return null;
    e.reuses++;
    return { kps: e.kps, cardId: e.cardId };
  }

  /**
   * The card recognised with reused corners: accepted only when it is the
   * card those corners were found for (or none was recognised then).
   * Otherwise the cache is emptied — the caller runs the detector.
   */
  acceptReused(cardId) {
    const e = this.entry;
    if (!e) return false;
    if (cardId && (e.cardId === null || e.cardId === cardId)) {
      e.cardId = cardId;
      return true;
    }
    this.clear();
    return false;
  }
}
