// Adapted from OpenRift packages/shared/src/scan/disambiguate.ts (AGPL-3.0)
// https://github.com/openriftapp/openrift, commit fb7f633c — Copyright Eiko Wagenknecht.
/**
 * Which printing of an artwork is in the photo (REPRODUIRE-SCANNER-OPENRIFT.md,
 * phase C): runes of several sets, « ★ » legends, tokens reprinted, promos.
 * The text is never read (no OCR): bands of the straightened photo are compared
 * with the same bands of each printing's picture —
 *   1. the name band (language — needs a picture per language),
 *   2. the code strip at the bottom left (set, number, promo, « * »),
 *   3. the stamp band at the bottom centre (stamped variants).
 * Each band: grey, cropped, reduced (never enlarged), normalised to mean 128
 * and deviation 48 (the pictures come from different sources).
 * Each stage is a tournament: a printing stays when its band correlates ≥ 0.55
 * with the photo; it wins when it beats every distinguishable rival by a
 * margin, measured only on the pixels where the two printings DIFFER (mask:
 * |A − B| ≥ 24 with 3 masked neighbours, at least 32 pixels). On a whole band a
 * wrong printing scored 0.905 and the right one, one pixel off, 0.826.
 * Each stage only works on what the one before could not separate.
 *
 * Pure functions: the app, and the bench (scripts/eval-printings.mjs).
 */
import { toGray, downscaleGray } from './alignedVerify.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Bands in fractions of the portrait card. */
const TEXT_REGION = { x0: 0.05, y0: 0.5, x1: 0.95, y1: 0.96 };
const NAME_BANDS = {
  unit: { x0: 0.07, y0: 0.53, x1: 0.93, y1: 0.67 },
  spell: { x0: 0.07, y0: 0.53, x1: 0.93, y1: 0.67 },
  gear: { x0: 0.07, y0: 0.53, x1: 0.93, y1: 0.67 },
  legend: { x0: 0.07, y0: 0.64, x1: 0.93, y1: 0.79 },
  rune: { x0: 0.07, y0: 0.64, x1: 0.93, y1: 0.79 },
};
export const CODE_BAND = { x0: 0.03, y0: 0.935, x1: 0.34, y1: 0.985 };
export const STAMP_BAND = { x0: 0.42, y0: 0.885, x1: 0.58, y1: 0.985 };
export const SIGNATURE_WIDTH = 128;
export const CODE_SIGNATURE_WIDTH = 96;
export const STAMP_SIGNATURE_WIDTH = 48;

/** Thresholds (OpenRift): score floor, margin to win. */
export const PRINTING_THRESHOLDS = {
  name: { minScore: 0.55, minMargin: 0.4 },
  code: { minScore: 0.55, minMargin: 0.15 },
  stamp: { minScore: 0.55, minMargin: 0.15 },
  stampMarkedMargin: 0.4,
};

export function textBandForType(type) {
  return NAME_BANDS[type] || TEXT_REGION;
}

function cropGray(src, r) {
  const x = Math.round(src.width * r.x0);
  const y = Math.round(src.height * r.y0);
  const width = Math.max(1, Math.round(src.width * (r.x1 - r.x0)));
  const height = Math.max(1, Math.round(src.height * (r.y1 - r.y0)));
  const data = new Uint8Array(width * height);
  for (let row = 0; row < height; row++) {
    const start = (y + row) * src.width + x;
    data.set(src.data.subarray(start, start + width), row * width);
  }
  return { data, width, height };
}

/** In place: mean 128, deviation 48, kept within 0..255. */
function normalizeSignature(sig) {
  const { data } = sig;
  let mean = 0;
  for (const v of data) mean += v;
  mean /= data.length;
  let variance = 0;
  for (const v of data) variance += (v - mean) * (v - mean);
  const std = Math.sqrt(variance / data.length);
  if (std === 0) return sig;
  const gain = 48 / std;
  for (let i = 0; i < data.length; i++) data[i] = clamp(Math.round(128 + (data[i] - mean) * gain), 0, 255);
  return sig;
}

/** A band reduced to `width` (height kept in proportion, within [minH, maxH]); null when it would be enlarged. */
function bandSignature(gray, band, width, minH, maxH, noUpscale) {
  const crop = cropGray(gray, band);
  if (noUpscale && crop.width < width) return null;
  const height = clamp(Math.round((width * crop.height) / Math.max(1, crop.width)), minH, maxH);
  if (noUpscale && crop.height < height) return null;
  return normalizeSignature(downscaleGray(crop, width, height));
}

/**
 * Signatures of a portrait card picture (RGBA): { name, code, stamp }, code or
 * stamp null when the picture is too small; null for a landscape picture.
 */
export function printingSignature(rgba, w, h, type) {
  if (w >= h) return null;
  const gray = toGray(rgba, w, h);
  return {
    name: bandSignature(gray, textBandForType(type), SIGNATURE_WIDTH, 24, 96, false),
    code: bandSignature(gray, CODE_BAND, CODE_SIGNATURE_WIDTH, 12, 32, true),
    stamp: bandSignature(gray, STAMP_BAND, STAMP_SIGNATURE_WIDTH, 16, 44, true),
  };
}

/** NCC of `q` shifted by (dx, dy) against `r`, optionally on a mask of r's pixels. */
function correlationAtOffset(q, r, dx, dy, mask) {
  const width = Math.min(q.width, r.width);
  const height = Math.min(q.height, r.height);
  let count = 0; let sQ = 0; let sR = 0; let sQQ = 0; let sRR = 0; let sQR = 0;
  for (let y = Math.max(0, -dy); y < height && y + dy < height; y++) {
    const qRow = (y + dy) * q.width;
    const rRow = y * r.width;
    for (let x = Math.max(0, -dx); x < width && x + dx < width; x++) {
      if (mask && mask[rRow + x] === 0) continue;
      const a = q.data[qRow + x + dx];
      const b = r.data[rRow + x];
      count++; sQ += a; sR += b; sQQ += a * a; sRR += b * b; sQR += a * b;
    }
  }
  if (count < 32) return 0;
  const cross = sQR - (sQ * sR) / count;
  const norm = Math.sqrt((sQQ - (sQ * sQ) / count) * (sRR - (sR * sR) / count));
  return norm <= 0 ? 0 : cross / norm;
}

const SHIFT_RADIUS = 2;
/** Best whole-band correlation within ±2 px, with its offset. */
export function bestShiftCorrelation(q, r) {
  let best = { score: -2, dx: 0, dy: 0 };
  for (let dy = -SHIFT_RADIUS; dy <= SHIFT_RADIUS; dy++) {
    for (let dx = -SHIFT_RADIUS; dx <= SHIFT_RADIUS; dx++) {
      const score = correlationAtOffset(q, r, dx, dy);
      if (score > best.score) best = { score, dx, dy };
    }
  }
  return best;
}

function shiftGray(src, dx, dy) {
  if (dx === 0 && dy === 0) return src;
  const { width, height } = src;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const sy = clamp(y + dy, 0, height - 1);
    for (let x = 0; x < width; x++) data[y * width + x] = src.data[sy * width + clamp(x + dx, 0, width - 1)];
  }
  return { data, width, height };
}

const MASK_THRESHOLD = 24;
/**
 * Lead of printing A over printing B on the photo, measured only where A and
 * B differ; null when the pair cannot be told apart (no comparable evidence).
 */
export function discriminativeMargin(query, refA, refB) {
  const reg = bestShiftCorrelation(refB, refA);
  if (reg.score < 0.4) return null;
  const alignedB = shiftGray(refB, reg.dx, reg.dy);
  const width = Math.min(refA.width, alignedB.width);
  const height = Math.min(refA.height, alignedB.height);
  const raw = new Uint8Array(refA.width * refA.height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(refA.data[y * refA.width + x] - alignedB.data[y * alignedB.width + x]) >= MASK_THRESHOLD) raw[y * refA.width + x] = 1;
    }
  }
  // A pixel counts only with 3+ masked neighbours (filters anti-aliasing).
  const mask = new Uint8Array(refA.width * refA.height);
  let masked = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!raw[y * refA.width + x]) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dy && !dx) continue;
          const ny = y + dy; const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) n += raw[ny * refA.width + nx];
        }
      }
      if (n >= 3) { mask[y * refA.width + x] = 1; masked++; }
    }
  }
  if (masked < 32) return null;
  const qa = bestShiftCorrelation(query, refA);
  const qb = bestShiftCorrelation(query, alignedB);
  return correlationAtOffset(query, refA, qa.dx, qa.dy, mask) - correlationAtOffset(query, alignedB, qb.dx, qb.dy, mask);
}

/**
 * One stage. signatures: Map key → signature | null. The winner beats every
 * distinguishable rival by minMargin and clears minScore; pairs `indistinct`
 * a priori count as no evidence.
 * → { pick: { key, margin, indistinguishable } | null, floored, evaluatedPairs }
 */
export function runPrintingTournament(query, signatures, minScore, minMargin, indistinct) {
  const entries = [...signatures].filter(([, s]) => s);
  const floored = entries.filter(([, s]) => bestShiftCorrelation(query, s).score >= minScore).map(([k]) => k);
  const flooredSet = new Set(floored);
  let evaluatedPairs = 0;
  let best = null;
  for (const [key, sig] of entries) {
    if (!flooredSet.has(key)) continue;
    let weakest = Infinity;
    let evaluated = 0;
    const indistinguishable = [];
    for (const [other, otherSig] of entries) {
      if (other === key) continue;
      const margin = indistinct?.(key, other) ? null : discriminativeMargin(query, sig, otherSig);
      if (margin === null) { indistinguishable.push(other); continue; }
      evaluated++;
      weakest = Math.min(weakest, margin);
    }
    evaluatedPairs += evaluated;
    if (evaluated > 0 && (!best || weakest > best.margin)) best = { key, margin: weakest, indistinguishable };
  }
  return { pick: best && best.margin >= minMargin ? best : null, floored, evaluatedPairs };
}

/**
 * The printing in the photo, or null (the user chooses).
 * query: printingSignature of the photo; signatures: Map key → printingSignature;
 * identityOf(key) → { code, markers ('' plain, 'promo'… stamped, undefined unknown), language }.
 * → { key, margin, indistinguishable, via: 'name' | 'code' | 'stamp' } | null
 */
export function resolvePrinting(query, signatures, identityOf, T = PRINTING_THRESHOLDS) {
  const markersOf = (k) => identityOf(k)?.markers;
  const nameSigs = new Map([...signatures].map(([k, s]) => [k, s?.name ?? null]));
  const name = runPrintingTournament(query.name, nameSigs, T.name.minScore, T.name.minMargin, (a, b) => {
    const la = identityOf(a)?.language; const lb = identityOf(b)?.language;
    return la !== undefined && lb !== undefined && la === lb;
  });
  let candidates;
  if (name.pick) {
    if (!name.pick.indistinguishable.length) return { ...name.pick, via: 'name' };
    candidates = [name.pick.key, ...name.pick.indistinguishable];
  } else if (name.evaluatedPairs === 0 && name.floored.length >= 2) {
    candidates = name.floored;
  } else {
    return null;
  }
  let plainStamp = null;
  if (query.code) {
    const codeSigs = new Map(candidates.map(k => [k, signatures.get(k)?.code ?? null]));
    const code = runPrintingTournament(query.code, codeSigs, T.code.minScore, T.code.minMargin, (a, b) => {
      const ca = identityOf(a)?.code; const cb = identityOf(b)?.code;
      return ca === undefined || cb === undefined || ca === cb;
    });
    const marked = code.pick ? markersOf(code.pick.key) : undefined;
    if (code.pick && (marked === undefined || marked === '' || code.pick.margin >= T.stampMarkedMargin)) return { ...code.pick, via: 'code' };
  }
  if (query.stamp) {
    const stampSigs = new Map(candidates.map(k => [k, signatures.get(k)?.stamp ?? null]));
    const stamp = runPrintingTournament(query.stamp, stampSigs, T.stamp.minScore, T.stamp.minMargin, (a, b) => {
      const ma = markersOf(a); const mb = markersOf(b);
      if (ma === undefined || mb === undefined) return true;
      // only plain-vs-stamped pairs: the stamp is at the bottom centre on the stamped one only
      return (ma === '') === (mb === '');
    });
    const marked = stamp.pick ? markersOf(stamp.pick.key) : undefined;
    if (stamp.pick && marked !== undefined && marked !== '' && stamp.pick.margin >= T.stampMarkedMargin) return { ...stamp.pick, via: 'stamp' };
    if (stamp.pick && marked === '') plainStamp = { ...stamp.pick, via: 'stamp' };
  }
  if (name.pick) {
    const members = [name.pick.key, ...name.pick.indistinguishable];
    const unmarked = members.find(k => markersOf(k) === '');
    if (unmarked === undefined) return null;
    return { key: unmarked, margin: name.pick.margin, indistinguishable: members.filter(k => k !== unmarked && !markersOf(k)), via: 'name' };
  }
  return plainStamp;
}

/** Identity of a catalog card for resolvePrinting: its code, its stamp, its language (cards of one catalog: one language). */
export function printingIdentity(card, language = 'en') {
  const label = `${card.variant || ''} ${card.printLabel || ''}`.toLowerCase();
  const markers = /promo|judge|launch|organized|play|stamp|prerelease|release|champion|top-8|winner/.test(label) ? 'promo' : '';
  return { code: card.code || card.id, markers, language };
}

// ─── Our addition: bands found again on an outline a few % off ───────────
/**
 * OpenRift's bands assume a tight outline (±2 px of the band's own size). Our
 * crops (YOLO corners, no edge snapping yet) can be a few % of the card off,
 * more than the code strip's own height (5 %). So each band of the photo is
 * looked for around its place, within ±`pad` of the card, at the reference's
 * scale: the position where it best matches the reference band (normalised
 * correlation) is the one kept. Like OpenRift's own stamp search.
 */
function nccAt(src, sx, sy, ref) {
  const n = ref.width * ref.height;
  let sQ = 0; let sR = 0; let sQQ = 0; let sRR = 0; let sQR = 0;
  for (let y = 0; y < ref.height; y++) {
    const qRow = (sy + y) * src.width + sx;
    const rRow = y * ref.width;
    for (let x = 0; x < ref.width; x++) {
      const a = src.data[qRow + x];
      const b = ref.data[rRow + x];
      sQ += a; sR += b; sQQ += a * a; sRR += b * b; sQR += a * b;
    }
  }
  const norm = Math.sqrt((sQQ - (sQ * sQ) / n) * (sRR - (sR * sR) / n));
  return norm <= 0 ? -1 : (sQR - (sQ * sR) / n) / norm;
}

function registeredBand(gray, band, ref, pad, noUpscale) {
  if (!ref) return null;
  const bandW = gray.width * (band.x1 - band.x0);
  const s = ref.width / bandW;
  if (noUpscale && s > 1) return null;
  const W = Math.max(1, Math.round(gray.width * s));
  const H = Math.max(1, Math.round(gray.height * s));
  const scaled = downscaleGray(gray, W, H);
  const bx = Math.round(W * band.x0);
  const by = Math.round(H * band.y0);
  const px = Math.round(pad.x * W);
  const py = Math.round(pad.y * H);
  let best = { score: -2, x: bx, y: by };
  for (let dy = -py; dy <= py; dy++) {
    const y = by + dy;
    if (y < 0 || y + ref.height > H) continue;
    for (let dx = -px; dx <= px; dx++) {
      const x = bx + dx;
      if (x < 0 || x + ref.width > W) continue;
      const score = nccAt(scaled, x, y, ref);
      if (score > best.score) best = { score, x, y };
    }
  }
  if (best.score <= -2) return null;
  const data = new Uint8Array(ref.width * ref.height);
  for (let y = 0; y < ref.height; y++) data.set(scaled.data.subarray((best.y + y) * W + best.x, (best.y + y) * W + best.x + ref.width), y * ref.width);
  return normalizeSignature({ data, width: ref.width, height: ref.height });
}

/** Padding of the band search, in fractions of the card. */
export const BAND_SEARCH_PAD = { x: 0.04, y: 0.04 };

/**
 * printingSignature of the photo with each band looked for around its place
 * (BAND_SEARCH_PAD), registered on `reference` (the printingSignature of one
 * printing of the artwork: they all share the layout).
 */
export function registeredPrintingSignature(rgba, w, h, type, reference, pad = BAND_SEARCH_PAD) {
  if (w >= h || !reference) return null;
  const gray = toGray(rgba, w, h);
  return {
    name: registeredBand(gray, textBandForType(type), reference.name, pad, false),
    code: registeredBand(gray, CODE_BAND, reference.code, pad, true),
    stamp: registeredBand(gray, STAMP_BAND, reference.stamp, pad, true),
  };
}

/**
 * A pick only stands when the printings it could not tell apart carry the same
 * code and stamp (duplicate pictures of one printing) — OpenRift's
 * unanimousPick. Two printings with the same picture but different codes stay
 * the user's choice.
 */
export function unanimousPick(pick, identityOf) {
  if (!pick) return false;
  const a = identityOf(pick.key);
  return pick.indistinguishable.every(k => { const b = identityOf(k); return b?.code === a?.code && b?.markers === a?.markers; });
}

/**
 * Simpler pick (our variant, measured against the tournament on the bench):
 * for each printing, its code strip is looked for in the photo around its
 * place (registeredBand, each printing on its own), and the best correlation
 * is kept. The printing with the best score wins when it is ≥ minScore and
 * leads every printing with ANOTHER code by minLead. Printings with the same
 * code (duplicate pictures) are not rivals.
 * → { key, score, lead, scores } | null
 */
export function pickByCodeSearch(rgba, w, h, signatures, identityOf, { minScore = 0.6, minLead = 0.08, pad = BAND_SEARCH_PAD, band = 'code' } = {}) {
  if (w >= h) return null;
  const gray = toGray(rgba, w, h);
  const scores = [];
  for (const [key, sig] of signatures) {
    const ref = sig?.[band];
    if (!ref) continue;
    const q = registeredBand(gray, band === 'code' ? CODE_BAND : STAMP_BAND, ref, pad, true);
    if (!q) continue;
    scores.push({ key, score: bestShiftCorrelation(q, ref).score });
  }
  if (!scores.length) return null;
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const code = identityOf(best.key)?.code;
  const rival = scores.find(s => identityOf(s.key)?.code !== code);
  const lead = rival ? best.score - rival.score : Infinity;
  if (best.score < minScore || lead < minLead) return null;
  return { key: best.key, score: best.score, lead, scores };
}
