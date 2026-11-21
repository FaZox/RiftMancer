/**
 * Card recognition index — pure JavaScript (browser, Android, Node test bench).
 *
 * Why not the raw cosine similarity? Colour grids are all-positive vectors:
 * two unrelated cards already score ≈ 0.84 on average, so a raw « 85 % » means
 * nothing and a card missing from the catalog was still « recognised ».
 *
 *   1. Centring: v' = (v − μ) / ‖v − μ‖ with μ the mean fingerprint of the
 *      catalog → unrelated cards score around 0.
 *   2. Decision by margin: accept only if s1 ≥ abs AND s1 − s2 ≥ margin,
 *      s2 = best score of a card with ANOTHER artwork (reprints with the same
 *      illustration share an `artGroup` and do not compete).
 *   3. Displayed confidence = calibrated probability (softmax with a
 *      temperature over the best artworks), level « Sûr / Probable / Incertain ».
 *
 * Thresholds are calibrated with `npm run eval:matcher` (scripts/eval-matcher.mjs),
 * see model/eval-report.json and the CHANGELOG.
 */

/**
 * Decision of the colour fingerprint (« Prudent », the only mode since lot
 * 1.4): calibrated for ≤ 1 % of cards outside the catalog taken —
 * simulated-photo bench: ~71 % taken right, 0.2 % wrong, ~29 % asked. The
 * fused score (colours + AI) has its own thresholds, in the catalog header.
 */
export const DECISION_PRUDENT = {
  abs: 0.44,        // minimum centred score (below: looks like no card)
  margin: 0.11,     // minimum lead over the best other artwork
  sureMargin: 0.2,  // « Sûr » above this lead (and abs)
  temperature: 0.0275,
};

/** Default decision. */
export const DECISION = DECISION_PRUDENT;

const TOP_K = 8;
// Bench --learn (Prudent mode, later photos in other conditions than the
// corrected ones): 0.3 is the smallest handicap that does not raise the
// out-of-catalog false positives (0.06 raised them from 0.3 % to 1.3 %).
export const LEARNED_PENALTY = 0.3;
const DEFAULT_SCALES = [16]; // 8×8 / 4×4 pooling tested on the bench: no gain

/** Averages a grid × grid × 3 vector down to size × size × 3. */
function pool(f, grid, size) {
  const step = grid / size;
  const out = new Float32Array(size * size * 3);
  for (let y = 0; y < grid; y++) {
    const oy = Math.floor(y / step);
    for (let x = 0; x < grid; x++) {
      const ox = Math.floor(x / step);
      const s = (y * grid + x) * 3;
      const d = (oy * size + ox) * 3;
      out[d] += f[s]; out[d + 1] += f[s + 1]; out[d + 2] += f[s + 2];
    }
  }
  const k = 1 / (step * step);
  for (let i = 0; i < out.length; i++) out[i] *= k;
  return out;
}

export class MatchIndex {
  /**
   * @param {{ id: string, f: Float32Array, artBottom?: number, artGroup?: string }[]} cards  features 0–1
   * @param {{ mean?: Float32Array, scales?: number[] }} [opts]
   *   scales: grid sizes compared (16 = catalog grid; 8 and 4 are pooled from it
   *   and tolerate a slightly misaligned crop). Score = mean of the cosines.
   *   Only for colour-grid fingerprints (grid × grid × 3 values); any other
   *   vector (embedding of an AI model, `generic: true` or a size that is not a
   *   grid) is centred, normalised and compared as is.
   */
  constructor(cards, opts = {}) {
    this.n = cards.length;
    this.rawDim = cards[0]?.f.length || 0;
    const g = Math.round(Math.sqrt(this.rawDim / 3));
    this.grid = !opts.generic && g * g * 3 === this.rawDim ? g : null;
    this.scales = this.grid ? (opts.scales || DEFAULT_SCALES).filter(sz => sz <= this.grid && this.grid % sz === 0) : [];
    this.dim = this.grid ? this.scales.reduce((a, sz) => a + sz * sz * 3, 0) : this.rawDim;
    this.ids = cards.map(c => c.id);
    this.group = cards.map(c => c.artGroup || c.id);
    // Learned examples (user corrections) count a little less than the
    // catalog's own pictures: a blurry example must not attract other photos.
    this.penalty = cards.map(c => (c.learned ? (opts.learnedPenalty ?? LEARNED_PENALTY) : 0));
    this.bottom = cards.map(c => (typeof c.artBottom === 'number' ? c.artBottom : 0.55));
    this.bottoms = [...new Set(this.bottom)];
    const rd = this.rawDim;
    // Mean fingerprint of the catalog.
    const mean = opts.mean || new Float32Array(rd);
    if (!opts.mean) {
      for (const c of cards) for (let i = 0; i < rd; i++) mean[i] += c.f[i];
      for (let i = 0; i < rd; i++) mean[i] /= Math.max(1, this.n);
    }
    this.mean = mean;
    const d = this.dim;
    // One contiguous array: centred + normalised fingerprints (fast dot products).
    this.vecs = new Float32Array(this.n * d);
    // Raw normalised fingerprints too (raw cosine at 16×16, the old rule — for the bench).
    this.raw = new Float32Array(this.n * rd);
    cards.forEach((c, k) => {
      this.vecs.set(this.transform(c.f), k * d);
      this.raw.set(normalize(c.f), k * rd);
    });
    this.groupSize = new Map();
    for (const g of this.group) this.groupSize.set(g, (this.groupSize.get(g) || 0) + 1);
  }

  /** Centred, normalised, multi-scale vector of a fingerprint (0–1 features at catalog grid). */
  transform(f) {
    const c = center(f, this.mean);
    if (!this.grid) return normalize(c); // generic vector (AI embedding)
    const k = 1 / Math.sqrt(this.scales.length);
    const out = new Float32Array(this.dim);
    let off = 0;
    for (const sz of this.scales) {
      const v = normalize(sz === this.grid ? c : pool(c, this.grid, sz));
      for (let i = 0; i < v.length; i++) out[off + i] = v[i] * k;
      off += v.length;
    }
    return out;
  }

  /** Prepares query views ({ byBottom: Map(bottom → features 0–1) }) for scoring. */
  prepare(views, mode = 'centered') {
    return views.map(v => {
      const m = new Map();
      for (const [b, f] of v.byBottom) m.set(b, mode === 'raw' ? normalize(f) : this.transform(f));
      return m;
    });
  }

  /**
   * Score of every entry for the query (max over views, minus the learned
   * penalty): Float32Array(n). Used to combine engines (fusion).
   */
  scoreAll(views, mode = 'centered') {
    const q = this.prepare(views, mode);
    const db = mode === 'raw' ? this.raw : this.vecs;
    const d = mode === 'raw' ? this.rawDim : this.dim;
    const fallback = this.bottoms[0];
    const out = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const off = i * d;
      let best = -Infinity;
      for (const m of q) {
        const qv = m.get(this.bottom[i]) || m.get(fallback);
        if (!qv) continue;
        let dot = 0;
        for (let j = 0; j < d; j++) dot += qv[j] * db[off + j];
        if (dot > best) best = dot;
      }
      out[i] = best - this.penalty[i];
    }
    return out;
  }

  /**
   * Best cards for the query (max over views), best first.
   * @param {object[]} views  from fingerprint.queryViews()
   * @param {{ mode?: 'centered'|'raw', k?: number, exclude?: (i: number) => boolean }} [o]
   * @returns {{ index: number, id: string, group: string, score: number }[]}
   */
  rank(views, { mode = 'centered', k = TOP_K, exclude } = {}) {
    const q = this.prepare(views, mode);
    const db = mode === 'raw' ? this.raw : this.vecs;
    const d = mode === 'raw' ? this.rawDim : this.dim;
    const fallback = this.bottoms[0];
    // Sorted insertion into a short list (no sort per card).
    const top = [];
    for (let i = 0; i < this.n; i++) {
      if (exclude && exclude(i)) continue;
      const off = i * d;
      let best = -Infinity;
      for (const m of q) {
        const qv = m.get(this.bottom[i]) || m.get(fallback);
        let dot = 0;
        for (let j = 0; j < d; j++) dot += qv[j] * db[off + j];
        if (dot > best) best = dot;
      }
      best -= this.penalty[i];
      if (top.length < k || best > top[top.length - 1].score) {
        let p = top.length < k ? top.length : k - 1;
        if (top.length < k) top.push(null);
        while (p > 0 && top[p - 1].score < best) { top[p] = top[p - 1]; p--; }
        top[p] = { index: i, id: this.ids[i], group: this.group[i], score: best };
      }
    }
    return top;
  }

  /**
   * The query fingerprint (0–1 features) in the orientation that matches
   * entry `i` best — what the app keeps as a learned example of that card.
   */
  bestView(views, i) {
    const d = this.dim;
    const off = i * d;
    let best = null;
    let bestDot = -Infinity;
    for (const v of views) {
      const f = v.byBottom.get(this.bottom[i]) || v.byBottom.get(this.bottoms[0]);
      if (!f) continue;
      const t = this.transform(f);
      let dot = 0;
      for (let j = 0; j < d; j++) dot += t[j] * this.vecs[off + j];
      if (dot > bestDot) { bestDot = dot; best = f; }
    }
    return best;
  }

  /** Name of the query view ('normal', 'rot180'…) that matches entry `i` best. */
  bestViewName(views, i) {
    const d = this.dim;
    const off = i * d;
    let best = null;
    let bestDot = -Infinity;
    for (const v of views) {
      const f = v.byBottom.get(this.bottom[i]) || v.byBottom.get(this.bottoms[0]);
      if (!f) continue;
      const t = this.transform(f);
      let dot = 0;
      for (let j = 0; j < d; j++) dot += t[j] * this.vecs[off + j];
      if (dot > bestDot) { bestDot = dot; best = v.name; }
    }
    return best;
  }

  /**
   * Guard against a wrong correction: false when this photo resembles another
   * artwork's references clearly more (≥ `gap`) than those of entry `i`.
   */
  learnable(views, i, gap = 0.1) {
    const top = this.rank(views, { k: 6 });
    const q = this.prepare(views);
    const d = this.dim;
    let own = -Infinity;
    for (const m of q) {
      const qv = m.get(this.bottom[i]) || m.get(this.bottoms[0]);
      let dot = 0;
      for (let j = 0; j < d; j++) dot += qv[j] * this.vecs[i * d + j];
      if (dot > own) own = dot;
    }
    const other = top.find(c => c.group !== this.group[i]);
    return !other || other.score - own < gap;
  }

  /**
   * Accept / reject the best candidate.
   * @returns {{ best, score, second, margin, accepted: boolean, level: 'sure'|'probable'|'uncertain', probability: number, sameArt: string[] }}
   */
  decide(top, t = DECISION) {
    if (!top.length) return { best: null, score: 0, second: 0, margin: 0, accepted: false, level: 'uncertain', probability: 0, sameArt: [] };
    const best = top[0];
    // Best score per artwork (reprints share one).
    const perGroup = [];
    const seen = new Set();
    for (const c of top) {
      if (seen.has(c.group)) continue;
      seen.add(c.group);
      perGroup.push(c.score);
    }
    const second = perGroup.length > 1 ? perGroup[1] : -1;
    const margin = best.score - second;
    const accepted = best.score >= t.abs && margin >= t.margin;
    const level = !accepted ? 'uncertain' : margin >= t.sureMargin ? 'sure' : 'probable';
    // Softmax over the artworks found (others contribute ~0 at this temperature).
    const mx = perGroup[0];
    let z = 0;
    for (const s of perGroup) z += Math.exp((s - mx) / t.temperature);
    const probability = 1 / z;
    // All the cards of the best artwork (reprints in other sets), even outside
    // the top list — once each (learned examples repeat a card id).
    const printings = this.groupSize.get(best.group) > 1
      ? [...new Set(this.ids.filter((_, i) => this.group[i] === best.group))]
      : [];
    const sameArt = printings.length > 1 ? printings : [best.id];
    return { best, score: best.score, second, margin, accepted, level, probability, sameArt };
  }
}

function center(f, mean) {
  const out = new Float32Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = f[i] - mean[i];
  return out;
}

function normalize(f) {
  let n = 0;
  for (let i = 0; i < f.length; i++) n += f[i] * f[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = f[i] / n;
  return out;
}

/** Float32Array 0–1 → base64 bytes (catalog format). */
export function encodeFeatures(f) {
  let bin = '';
  for (let i = 0; i < f.length; i++) bin += String.fromCharCode(Math.max(0, Math.min(255, Math.round(f[i] * 255))));
  return typeof btoa === 'function' ? btoa(bin) : globalThis.Buffer.from(bin, 'latin1').toString('base64');
}

/** Fingerprint bytes (base64, catalog format) or legacy float list → Float32Array 0–1. */
export function decodeFeatures(raw) {
  if (typeof raw !== 'string') return Float32Array.from(raw);
  const bin = typeof atob === 'function' ? atob(raw) : globalThis.Buffer.from(raw, 'base64').toString('latin1');
  const f = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) f[i] = bin.charCodeAt(i) / 255;
  return f;
}

/**
 * Groups of cards with the same illustration (reprints): centred similarity
 * ≥ threshold, transitively. Returns Map(id → groupId) for groups of 2+ cards.
 */
export function computeArtGroups(cards, threshold = 0.98) {
  const idx = new MatchIndex(cards, { scales: [Math.round(Math.sqrt(cards[0].f.length / 3))] });
  const d = idx.dim;
  const parent = idx.ids.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let a = 0; a < idx.n; a++) {
    for (let b = a + 1; b < idx.n; b++) {
      if (idx.bottom[a] !== idx.bottom[b]) continue; // different layouts never look identical
      let dot = 0;
      const oa = a * d;
      const ob = b * d;
      for (let j = 0; j < d; j++) dot += idx.vecs[oa + j] * idx.vecs[ob + j];
      if (dot >= threshold) parent[find(a)] = find(b);
    }
  }
  const members = new Map();
  idx.ids.forEach((id, i) => {
    const r = find(i);
    if (!members.has(r)) members.set(r, []);
    members.get(r).push(id);
  });
  const out = new Map();
  for (const ids of members.values()) {
    if (ids.length < 2) continue;
    const gid = [...ids].sort()[0];
    for (const id of ids) out.set(id, gid);
  }
  return out;
}
