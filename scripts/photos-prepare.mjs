/**
 * Real photos for the test bench (AMELIORATIONS-MODELES.md 1.3).
 *
 *   1. Put your phone photos in model/real-photos-raw/<card>/  (one folder per
 *      card; <card> = the card id « ogn-042-298 » or its code « OGN-042 »).
 *   2. npm run photos:prepare
 *   3. npm run eval:matcher -- --compare …   (the real photos are measured apart)
 *
 * Each photo goes through the app's own chain: YOLO (same model, same
 * letterbox, same confidence threshold) then the same perspective
 * straightening (perspectiveCrop.warpQuadRGBA). The crop is written to
 * model/real-photos/<card id>/<photo>.png. Photos where YOLO finds no card
 * are listed (they also say something about the detector).
 *
 * Options: --in <dir> --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';
import { warpQuadRGBA } from '../src/lib/perspectiveCrop.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = (name, def) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : def);
const IN = path.resolve(root, opt('in', 'model/real-photos-raw'));
const OUT = path.resolve(root, opt('out', 'model/real-photos'));
const MODEL = 'yolo11s-pose-riftbound-dyn.onnx'; // the app's detector (dynamic input)
const SIZE = 416;          // yoloDetector MODE_SIZES.photo
const CONFIDENCE = 0.6;    // yoloDetector confidenceThreshold

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public', 'card-hashes.json'), 'utf8')).cards;
const ids = new Set(catalog.map(c => c.id));
/** Folder name → card id (id itself, or a printed code such as « OGN-042 » / « RAD-R02 »). */
function cardIdOf(folder) {
  const f = folder.trim().toLowerCase();
  if (ids.has(f)) return f;
  const code = folder.trim().toUpperCase();
  const hit = catalog.filter(c => String(c.code || '').toUpperCase().split('/')[0] === code);
  return hit.length === 1 ? hit[0].id : null;
}

/** YOLO on one image (same pre / post-processing as yoloDetector._onnxDetect). */
async function detect(session, rgba, w, h) {
  const scale = Math.min(SIZE / w, SIZE / h);
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);
  const padX = (SIZE - newW) / 2;
  const padY = (SIZE - newH) / 2;
  const { data } = await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), { raw: { width: w, height: h, channels: 4 } })
    .resize(newW, newH, { fit: 'fill' })
    .extend({ top: Math.floor(padY), bottom: SIZE - newH - Math.floor(padY), left: Math.floor(padX), right: SIZE - newW - Math.floor(padX), background: { r: 114, g: 114, b: 114, alpha: 1 } })
    .raw().toBuffer({ resolveWithObject: true });
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = data[i * 4] / 255;
    input[plane + i] = data[i * 4 + 1] / 255;
    input[2 * plane + i] = data[i * 4 + 2] / 255;
  }
  const out = await session.run({ images: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const o = out.output0 || out[Object.keys(out)[0]];
  const n = o.dims[o.dims.length - 1];
  const d = o.data;
  let best = null;
  for (let i = 0; i < n; i++) {
    const conf = d[4 * n + i];
    if (conf < CONFIDENCE || (best && conf <= best.conf)) continue;
    const kps = [];
    for (let k = 0; k < 4; k++) kps.push([(d[(5 + k * 2) * n + i] - padX) / scale, (d[(6 + k * 2) * n + i] - padY) / scale]);
    best = { conf, kps };
  }
  return best;
}

if (!fs.existsSync(IN)) {
  fs.mkdirSync(IN, { recursive: true });
  console.log(`Dossier créé : ${IN}\nMettez-y vos photos : un sous-dossier par carte (id « ogn-042-298 » ou code « OGN-042 »), puis relancez.`);
  process.exit(0);
}
const session = await ort.InferenceSession.create(path.join(root, 'public', 'models', MODEL), { executionProviders: ['cpu'] });
let ok = 0;
const missed = [];
const unknown = [];
for (const folder of fs.readdirSync(IN)) {
  const dir = path.join(IN, folder);
  // grilles/: several cards per photo, measured by eval-detector only
  if (folder === 'grilles' || !fs.statSync(dir).isDirectory()) continue;
  const id = cardIdOf(folder);
  if (!id) { unknown.push(folder); continue; }
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(jpe?g|png|webp|heic)$/i.test(f)) continue;
    // .rotate(): apply the phone's EXIF orientation, like a browser does
    const { data, info } = await sharp(path.join(dir, f)).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const det = await detect(session, new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
    if (!det) { missed.push(`${folder}/${f}`); continue; }
    const crop = warpQuadRGBA(data, info.width, info.height, det.kps);
    fs.mkdirSync(path.join(OUT, id), { recursive: true });
    await sharp(Buffer.from(crop.data.buffer), { raw: { width: crop.w, height: crop.h, channels: 4 } })
      .png().toFile(path.join(OUT, id, `${path.parse(f).name}.png`));
    ok++;
  }
}
console.log(`${ok} photo(s) recadrée(s) dans ${OUT}`);
if (missed.length) console.log(`Aucune carte détectée par YOLO (${missed.length}) :\n  ${missed.join('\n  ')}`);
if (unknown.length) console.log(`Dossiers dont la carte est inconnue (${unknown.length}) : ${unknown.join(', ')} — nommez-les avec l’id ou le code de la carte.`);
