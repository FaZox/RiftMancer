/**
 * « Rechercher de nouvelles cartes » (lot 4.2), part 2: what the former
 * Python chain made for each card, now in the PC app (browser APIs, no Python):
 *   - the image: landscape cards turned to portrait (PIL rotate(90): a quarter
 *     turn anticlockwise), saved as WebP quality 80 → cards/<id>.webp;
 *   - the thumbnail: 300 px wide, WebP quality 85 → cards/thumbs/<id>.webp;
 *   - the colour fingerprint: fingerprint.js on the saved WebP, as the scraper
 *     did on its saved file (same crop, same grid);
 *   - the AI signature: the shipped model on the same image (build-embeddings.mjs).
 * Parity is checked first on 50 cards of the shipped catalog: their images give
 * back their fingerprints and signatures, or nothing is installed (the
 * recognition thresholds would not hold for the new cards).
 */
import { gridFeatures } from './fingerprint.js';
import { encodeFeatures, decodeFeatures } from './matchIndex.js';
import { encodeEmbedding, decodeEmbedding } from './engines/index.js';

/** Tolerances of the parity check (decoders round differently by one step at most). */
export const PARITY = { samples: 50, maxByteDiff: 2, minExact: 0.97, minCosine: 0.995 };

/** Bytes (PNG, JPEG, WebP) → { rgba, w, h } in sRGB, no colour management. */
export async function decodeImage(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes]), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close?.();
  return { rgba: data, w: c.width, h: c.height };
}

async function encodeWebp(canvas, quality) {
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  if (blob.type !== 'image/webp') throw new Error('Ce PC ne sait pas écrire d’image WebP.');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Official image → the card's WebP (portrait) and its thumbnail. */
export async function cardImages(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes]), { colorSpaceConversion: 'none' });
  const landscape = bmp.width > bmp.height;
  const w = landscape ? bmp.height : bmp.width, h = landscape ? bmp.width : bmp.height;
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d');
  if (landscape) { ctx.translate(0, h); ctx.rotate(-Math.PI / 2); } // anticlockwise, as PIL rotate(90, expand=True)
  ctx.drawImage(bmp, 0, 0);
  const card = await encodeWebp(c, 0.8);
  const tw = Math.min(300, w), th = Math.round(h * tw / w);
  const t = new OffscreenCanvas(tw, th);
  const tctx = t.getContext('2d');
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(c, 0, 0, tw, th);
  const thumb = await encodeWebp(t, 0.85);
  bmp.close?.();
  return { card, thumb, landscape };
}

/** Fingerprint and AI signature of a card image (its saved WebP). */
export async function cardFeatures(webpBytes, artBottom, engine) {
  const { rgba, w, h } = await decodeImage(webpBytes);
  const f = encodeFeatures(gridFeatures(rgba, w, h, artBottom));
  const e = engine ? encodeEmbedding(await engine.embedCatalog(rgba, w, h, { region: 'art', bottom: artBottom })) : null;
  return { f, e };
}

function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / Math.sqrt(na * nb);
}

/** Cards spread over the catalog (every set), always the same ones. */
export function paritySample(cards, n = PARITY.samples) {
  const usable = cards.filter(c => !c.manual && typeof c.f === 'string');
  const step = usable.length / n;
  return Array.from({ length: Math.min(n, usable.length) }, (_, i) => usable[Math.floor(i * step)]);
}

/**
 * Parity (lot 4.2): recompute the fingerprint and AI signature of `sample`
 * cards of the shipped catalog and compare. `compute(card)` → { f, e } (the
 * app: cardFeatures on the card's shipped image).
 * Returns { ok, cards, worstByte, exact, minCosine, failures: [id] }.
 */
export async function checkParity(sample, compute, onProgress = () => {}) {
  let worstByte = 0, exactBytes = 0, totalBytes = 0, minCos = 1;
  const failures = [];
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    const got = await compute(c);
    const a = decodeFeatures(c.f), b = decodeFeatures(got.f);
    let worst = a.length === b.length ? 0 : 255;
    for (let k = 0; k < Math.min(a.length, b.length); k++) {
      const d = Math.abs(Math.round(a[k] * 255) - Math.round(b[k] * 255));
      worst = Math.max(worst, d);
      if (d === 0) exactBytes++;
    }
    totalBytes += a.length;
    worstByte = Math.max(worstByte, worst);
    let cos = 1;
    if (typeof c.e === 'string') cos = got.e ? cosine(decodeEmbedding(c.e), decodeEmbedding(got.e)) : 0;
    minCos = Math.min(minCos, cos);
    if (worst > PARITY.maxByteDiff || cos < PARITY.minCosine) failures.push(c.id);
    onProgress(i + 1, sample.length);
  }
  const exact = totalBytes ? exactBytes / totalBytes : 1;
  return {
    ok: !failures.length && exact >= PARITY.minExact,
    cards: sample.length, worstByte, exact, minCosine: minCos, failures,
  };
}

/** Fingerprint on the crop common to every layout (reprint groups, artGroups.js). */
export async function commonFingerprint(webpBytes, bottom) {
  const { rgba, w, h } = await decodeImage(webpBytes);
  return gridFeatures(rgba, w, h, bottom);
}
