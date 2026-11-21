/**
 * Hands-free scan (lot 8.1, B.6.8): the phone on a stand (or the PC's
 * webcam) watches the table; a scan starts when a NEW card is put down and
 * no longer moves — no tap. Pure: tests/handsFree.test.mjs.
 *
 * It looks at small grey signatures of the video (cornerCache.js, ≈ 1 ms
 * each, every HF.interval ms):
 *   - still: the picture barely changes from one look to the next
 *     (mean difference ≤ stillDiff) for stillSamples looks in a row
 *     (≈ 450 ms — the ring on screen fills meanwhile);
 *   - new: compared with the picture of the last scan, enough of the frame
 *     changed (≥ changeShare of the cells by more than cellDiff) — the same
 *     card left on the table is never scanned twice, and neither is the
 *     empty table once seen.
 */
import { meanDiff } from './cornerCache.js';

export const HF = {
  interval: 150,      // ms between two looks
  stillSamples: 3,    // looks in a row without movement
  stillDiff: 5,       // mean |Δ| of the grey levels (0–255) between two looks
  cellDiff: 28,       // a cell « changed » since the last scan…
  changeShare: 0.06,  // …and this share of the cells must have changed
};

/** Share of the cells that changed by more than `thr` grey levels. */
export function changedShare(a, b, thr = HF.cellDiff) {
  if (!a || !b || a.w !== b.w || a.h !== b.h) return 1;
  let n = 0;
  for (let i = 0; i < a.data.length; i++) if (Math.abs(a.data[i] - b.data[i]) > thr) n++;
  return n / a.data.length;
}

/**
 * The watcher. step(sig) after each look →
 *   { state: 'waiting' }                nothing new since the last scan
 *   { state: 'moving' }                 something changes, not still yet
 *   { state: 'settling', progress }     still, the ring fills (0…1)
 *   { state: 'fire' }                   scan now, then call scanned(sig)
 */
export function createHandsFree(opts = {}) {
  const o = { ...HF, ...opts };
  let prev = null;
  let still = 0;
  let ref = null; // picture of the last scan (null: nothing scanned yet)
  return {
    step(sig) {
      const d = prev ? meanDiff(sig, prev) : Infinity;
      prev = sig;
      still = d <= o.stillDiff ? still + 1 : 0;
      if (ref && changedShare(sig, ref, o.cellDiff) < o.changeShare) return { state: 'waiting', progress: 0 };
      if (still >= o.stillSamples) return { state: 'fire', progress: 1 };
      return still ? { state: 'settling', progress: still / o.stillSamples } : { state: 'moving', progress: 0 };
    },
    /** After a scan (whatever the result): this picture is « seen ». */
    scanned(sig) { ref = sig; still = 0; },
    reset() { prev = null; still = 0; ref = null; },
  };
}
