/**
 * Simulated phone photos of the catalog cards (shared by the test benches:
 * eval-matcher.mjs and engineBench.mjs) — rotation, slight perspective,
 * shifted crop, light, white balance, blur, sleeve glare, JPEG, noise.
 */
import sharp from 'sharp';

export const W = 480; // size of the perspective-corrected crop in the app
export const H = 670;

// ─── Deterministic random ────────────────────────────────────────────────
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const between = (r, a, b) => a + (b - a) * r();
export function gauss(r) {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const BG = { r: 24, g: 22, b: 28, alpha: 1 };

/**
 * One simulated phone photo of a card, as the app's crop: W × H RGBA.
 * Strength of the perturbations: random in `range` (0 = clean, 1 = hard), or
 * fixed by `geo` / `light`.
 */
export async function simulatePhoto(file, r, range = [0, 1], { geo = NaN, light = NaN } = {}) {
  const strength = () => range[0] + (range[1] - range[0]) * r();
  const GEO = Number.isNaN(geo) ? strength() : geo;
  const LIGHT = Number.isNaN(light) ? strength() : light;
  // Geometry: slight perspective (shear), rotation, shifted crop.
  const shx = between(r, -0.04, 0.04) * GEO;
  const shy = between(r, -0.03, 0.03) * GEO;
  const angle = between(r, -5, 5) * GEO;
  let { data, info } = await sharp(file).resize(W, H, { fit: 'fill' })
    .affine([[1, shx], [shy, 1]], { background: BG })
    .rotate(angle, { background: BG })
    .raw().toBuffer({ resolveWithObject: true });
  const dx = Math.round(between(r, -0.04, 0.04) * W * GEO);
  const dy = Math.round(between(r, -0.04, 0.04) * H * GEO);
  const left = Math.max(0, Math.min(info.width - W, Math.round((info.width - W) / 2) + dx));
  const top = Math.max(0, Math.min(info.height - H, Math.round((info.height - H) / 2) + dy));
  let img = sharp(data, { raw: info }).extract({ left, top, width: Math.min(W, info.width), height: Math.min(H, info.height) })
    .resize(W, H, { fit: 'fill' });

  // Light: brightness ±30 %, saturation, white balance.
  const L = (a, b) => 1 + (between(r, a, b) - 1) * LIGHT;
  img = img.modulate({ brightness: L(0.7, 1.3), saturation: L(0.8, 1.2) })
    .linear([L(0.9, 1.1), L(0.9, 1.1), L(0.9, 1.1)], [0, 0, 0]);
  const sigma = between(r, 0, 1.5) * LIGHT;
  if (sigma >= 0.3) img = img.blur(sigma);
  ({ data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true }));

  // Sleeve glare: a white radial highlight, one photo in two.
  let pipeline = sharp(data, { raw: info });
  if (r() < 0.5 * LIGHT) {
    const gx = Math.round(between(r, 0.15, 0.85) * W);
    const gy = Math.round(between(r, 0.1, 0.7) * H);
    const rad = Math.round(between(r, 0.15, 0.35) * W);
    const op = (between(r, 0.2, 0.5) * LIGHT).toFixed(2);
    const svg = `<svg width="${W}" height="${H}"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity="${op}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><ellipse cx="${gx}" cy="${gy}" rx="${rad}" ry="${Math.round(rad * 0.6)}" fill="url(#g)"/></svg>`;
    pipeline = pipeline.composite([{ input: Buffer.from(svg) }]);
  }
  // JPEG compression.
  const jpg = await pipeline.jpeg({ quality: LIGHT > 0 ? Math.round(between(r, 55, 85)) : 95 }).toBuffer();
  ({ data, info } = await sharp(jpg).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));

  // Sensor noise.
  const noise = between(r, 2, 8) * LIGHT;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = data[i] + gauss(r) * noise;
    out[i + 1] = data[i + 1] + gauss(r) * noise;
    out[i + 2] = data[i + 2] + gauss(r) * noise;
    out[i + 3] = 255;
  }
  return { rgba: out, w: info.width, h: info.height };
}

/** A real photo (model/real-photos), resized like the app's crop. */
export async function realPhoto(file) {
  const { data, info } = await sharp(file).rotate().resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: data, w: info.width, h: info.height };
}

