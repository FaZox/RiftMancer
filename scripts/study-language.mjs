/**
 * Study (lot 8.3, docs/ETUDE-LANGUE.md): can the scanner read the card's
 * language? French cards print « • FR » after the collector number, the
 * English cards of the newer sets « • EN », the older English cards nothing.
 * Measured on the real bench photos, card rectified like the app does.
 *
 *   node scripts/eval-detector.mjs --scenes 0 --no-identify --dump corners.json
 *   node scripts/study-language.mjs corners.json [--strips <dir>]
 *
 * Truth: model/real-photos-raw/_langues.json (read by eye: FR, EN, none,
 * ? unreadable, na rune / battlefield). Not used by the app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const STRIPS = argv.includes('--strips') ? argv[argv.indexOf('--strips') + 1] : null;
const { warpQuadRGBA } = await import(pathToFileURL(path.join(root, 'src/lib/perspectiveCrop.js')).href);
const truth = JSON.parse(fs.readFileSync(path.join(root, 'model/real-photos-raw/_langues.json'), 'utf8')).photos;
const rows = JSON.parse(fs.readFileSync(argv[0], 'utf8')).filter(r => r.kind === 'real' && r.model.endsWith('@416'));

// The left part of the bottom line, « OGN • 030/298 • FR », as a 480 × 64 grey strip
const STRIP = { x0: 0.02, x1: 0.50, y0: 0.925, y1: 0.99 };
const W = 480, H = 64;
async function stripOf(r) {
  const { data, info } = await sharp(r.file).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const c = warpQuadRGBA(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, r.kps);
  const card = sharp(Buffer.from(c.data.buffer, c.data.byteOffset, c.data.length), { raw: { width: c.w, height: c.h, channels: 4 } });
  const s = card.extract({ left: Math.round(STRIP.x0 * c.w), top: Math.round(STRIP.y0 * c.h), width: Math.round((STRIP.x1 - STRIP.x0) * c.w), height: Math.round((STRIP.y1 - STRIP.y0) * c.h) })
    .resize({ width: W, height: H, fit: 'fill' }).greyscale();
  if (STRIPS) await s.clone().png().toFile(path.join(STRIPS, `${path.basename(r.file)}.png`));
  return (await s.raw().toBuffer());
}

/**
 * The reader: ink = brighter than the row's median by `add`, without the
 * frame's long lines (runs over `run` px); the text line = the 14 rows with
 * the most glyph starts (lower part of the strip); words split by `gap` empty
 * columns; the number = widest word (≥ `num` px); a word of 12–50 px within
 * 75 px after it = a mark (FR / EN by the first letter's bottom bar).
 */
function read(g, { gap = 7, run = 36, add = 35, num = 55 } = {}) {
  const ink = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const t = [...g.subarray(y * W, y * W + 300)].sort((a, b) => a - b)[150] + add;
    let s = -1;
    for (let x = 0; x <= W; x++) {
      const on = x < W && g[y * W + x] > t;
      if (on && s < 0) s = x;
      if (!on && s >= 0) { if (x - s <= run) for (let k = s; k < x; k++) ink[y * W + k] = 1; s = -1; }
    }
  }
  const starts = [];
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 1; x < 340; x++) if (ink[y * W + x] && !ink[y * W + x - 1]) n++; starts.push(n); }
  let best = -1, by = 0;
  for (let y = 26; y + 14 <= H; y++) { const s = starts.slice(y, y + 14).reduce((a, b) => a + b, 0); if (s > best) { best = s; by = y; } }
  if (best < 25) return { mark: null, legible: false };
  const col = new Array(W).fill(0);
  for (let y = by; y < by + 14; y++) for (let x = 0; x < W; x++) col[x] += ink[y * W + x];
  const words = [];
  let s = -1, empty = 0;
  for (let x = 0; x < W; x++) {
    if (col[x]) { if (s < 0) s = x; empty = 0; } else if (s >= 0 && ++empty >= gap) { words.push([s, x - empty]); s = -1; empty = 0; }
  }
  if (s >= 0) words.push([s, W - 1]);
  const width = (w) => w[1] - w[0] + 1;
  const number = words.filter(w => width(w) >= num).sort((a, b) => width(b) - width(a))[0];
  if (!number) return { mark: null, legible: false };
  const mark = words.find(w => w[0] > number[1] && w[0] < number[1] + 75 && width(w) >= 12 && width(w) <= 50);
  if (!mark) return { mark: null, legible: true };
  let low = 0, all = 0;
  const end = Math.round((mark[0] + mark[1]) / 2);
  for (let y = by; y < by + 14; y++) for (let x = mark[0]; x <= end; x++) if (ink[y * W + x]) { all++; if (y >= by + 9 && x > mark[0] + 2) low++; }
  return { mark: all && low / all > 0.22 ? 'EN' : 'FR', legible: true };
}

// Older sets never print « EN »: a mark there is French; nothing after a legible number is English
const OLD = new Set(['OGN', 'OGS', 'SFD', 'UNL']);
function decide(setCode, r) {
  if (r.mark) return OLD.has(setCode) ? 'FR' : r.mark;
  return r.legible && OLD.has(setCode) ? 'EN' : null;
}

if (STRIPS) fs.mkdirSync(STRIPS, { recursive: true });
const res = [];
for (const r of rows) {
  const key = path.relative(path.join(root, 'model/real-photos-raw'), r.file).split(path.sep).join('/');
  const lab = truth[key];
  if (!lab) continue;
  const d = decide(r.truth.split('-')[0].toUpperCase(), read(await stripOf(r)));
  res.push({ key, lab, d, small: r.w <= 1080 });
}
const line = (title, list) => {
  const c = (f) => list.filter(f).length;
  const fr = c(x => x.d === 'FR'), frOk = c(x => x.d === 'FR' && x.lab === 'FR');
  const en = c(x => x.d === 'EN'), enOk = c(x => x.d === 'EN' && (x.lab === 'none' || x.lab === 'EN'));
  console.log(`${title.padEnd(28)} photos ${String(list.length).padStart(3)} · « FR » dit ${fr} (juste ${frOk}, sur ${c(x => x.lab === 'FR')} FR) · « anglaise » dite ${en} (juste ${enOk}) · rien dit ${c(x => !x.d)}`);
};
line('Toutes les photos', res);
line('Photos de l’appli (≤ 1080 px)', res.filter(x => x.small));
console.log('Erreurs :', res.filter(x => (x.d === 'FR' && x.lab !== 'FR') || (x.d === 'EN' && x.lab !== 'none' && x.lab !== 'EN')).map(x => `${x.key} (${x.lab} → ${x.d})`).join(', ') || 'aucune');
