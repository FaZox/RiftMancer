/**
 * Frame check (AMELIORATIONS-MODELES.md, step 5.1 — measured 2026-11-14, ON HOLD:
 * no gain on the recalibrated bench; fair end-to-end test still to do, model/MODELS.md): the colour of the card's
 * name bar — the domain colour of standard cards — must match the colour of
 * the PROPOSED card's own name bar (catalog field `bar`). A clear mismatch
 * turns an accepted result into a doubtful one: it never picks a card by
 * itself.
 *
 * Pure (no DOM): RGBA pixels of the straightened card (portrait).
 *   - white balance on the bright pixels of the rules text box;
 *   - the name bar sits at a fixed height on standard cards (bottom of the bar
 *     at 63 % of the card, measured on the catalog): its hue on the left and on
 *     the right (two-domain cards have a gradient), weighted by saturation.
 * Cards whose own catalog bar is not clearly coloured (full art, legends,
 * battlefields, colourless…) have no `bar`: they are never checked.
 */

export const BAR_ROWS = [0.598, 0.628];
export const TOLERANCE = 50; // degrees of hue

function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx > 0 ? d / mx : 0, mx];
}

/**
 * Name bar colour of a straightened card.
 * @returns {{ left: { hue, coloured, strength }, right: { … } } | null}
 *   null when the rules text box gives no white reference (dark / coloured).
 */
export function barColour(rgba, w, h) {
  const ref = [];
  for (let y = Math.floor(h * 0.7); y < Math.floor(h * 0.86); y += 2) {
    for (let x = Math.floor(w * 0.12); x < Math.floor(w * 0.88); x += 2) {
      const i = (y * w + x) * 4;
      ref.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    }
  }
  if (!ref.length) return null;
  ref.sort((a, b) => (b[0] + b[1] + b[2]) - (a[0] + a[1] + a[2]));
  const top = ref.slice(0, Math.max(1, Math.floor(ref.length * 0.3)));
  const m = [0, 1, 2].map(c => top.reduce((s, p) => s + p[c], 0) / top.length);
  const lum = (m[0] + m[1] + m[2]) / 3;
  const refSat = (Math.max(...m) - Math.min(...m)) / Math.max(1, Math.max(...m));
  if (lum < 110 || refSat > 0.35) return null;
  const gain = m.map(v => lum / Math.max(1, v));
  const part = (fx0, fx1) => {
    let x = 0;
    let y = 0;
    let wsum = 0;
    let n = 0;
    let k = 0;
    for (let yy = Math.floor(h * BAR_ROWS[0]); yy < Math.ceil(h * BAR_ROWS[1]); yy++) {
      for (let xx = Math.floor(w * fx0); xx < Math.floor(w * fx1); xx++) {
        const i = (yy * w + xx) * 4;
        const [hh, ss, vv] = rgb2hsv(Math.min(255, rgba[i] * gain[0]), Math.min(255, rgba[i + 1] * gain[1]), Math.min(255, rgba[i + 2] * gain[2]));
        n++;
        if (ss > 0.25 && vv > 50) {
          k++;
          const a = (hh * Math.PI) / 180;
          x += Math.cos(a) * ss;
          y += Math.sin(a) * ss;
          wsum += ss;
        }
      }
    }
    if (!wsum) return { hue: null, coloured: 0, strength: 0 };
    let hue = (Math.atan2(y, x) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    return { hue, coloured: k / n, strength: Math.hypot(x, y) / wsum };
  };
  return { left: part(0.08, 0.36), right: part(0.64, 0.92) };
}

/**
 * Catalog reference of a card (field `bar`: [left hue, right hue], degrees),
 * from its catalog image — or null when its bar is not clearly coloured.
 */
export function barReference(rgba, w, h, card = {}) {
  if (card.orientation && card.orientation !== 'portrait') return null;
  if (card.artBottom >= 0.9) return null; // full art
  const b = barColour(rgba, w, h);
  if (!b) return null;
  for (const s of [b.left, b.right]) if (s.hue == null || s.coloured < 0.6 || s.strength < 0.85) return null;
  return [Math.round(b.left.hue), Math.round(b.right.hue)];
}

const hueDist = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * 'skip' (card not checked, or bar not measurable on the photo), 'ok', or
 * 'conflict' (the photo's bar has clearly another colour than the card's).
 */
export function frameCheck(measured, bar, tolerance = TOLERANCE) {
  if (!bar || !measured) return 'skip';
  const sides = [[measured.left, bar[0]], [measured.right, bar[1]]].filter(([s]) => s.hue != null && s.coloured > 0.35);
  if (!sides.length) return 'skip';
  for (const [s, ref] of sides) if (hueDist(s.hue, ref) > tolerance) return 'conflict';
  return 'ok';
}
