/**
 * AI signatures of the catalog cards (AMELIORATIONS-MODELES.md, step 4.1).
 *
 *   node scripts/build-embeddings.mjs     (run by `npm run catalog:update` and refresh_prod.sh)
 *
 * Bench only — a catalog made with another engine, written elsewhere (the
 * app's catalog is not touched), with its own calibrated thresholds:
 *   node scripts/build-embeddings.mjs --engine dinov2s-int8-mean-140 \
 *     --out model/cache/card-hashes-140.json --prudent 0.44,0.11 --fast 0.34,0.06
 *   (--model <file>: another model file, e.g. the float32 DINOv2 of model/embedders/)
 *
 * For every card of public/card-hashes.json: the vector of its illustration
 * given by the recognition model (public/models/dinov2s-ft-fp16.onnx, DINOv2-small
 * fine-tuned on the cards — model/train_embedder.py — float16, mean of the
 * patch tokens), stored in the card itself as `e` (int8 +
 * scale, see engines/encodeEmbedding — ≈ 0.7 MB for the catalog). The
 * catalog's `embeddings` header says which model made them (SHA-256: the app
 * refuses vectors made by another model), how to combine them with the colour
 * fingerprint and the decision thresholds calibrated on the bench.
 *
 * Vectors are kept in model/cache/ (per model): only new cards are computed.
 * The signatures travel to the phone inside the catalog (same sync, same
 * SHA-256 check).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';
import { createOnnxEngine, ENGINE_CONFIGS, encodeEmbedding } from '../src/lib/engines/index.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = (k, d) => (process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : d);
const pair = (v) => { const [abs, margin] = v.split(',').map(Number); return { abs, margin }; };
const ENGINE = opt('engine', 'dinov2s-ft-fp16-mean-168');
// --model: another model file (bench, e.g. model/embedders/dinov2s/model.onnx, float32)
const MODEL_PATH = opt('model') ? path.resolve(root, opt('model')) : null;
const MODEL = MODEL_PATH ? path.basename(MODEL_PATH) : 'dinov2s-ft-fp16.onnx';
const REGION = 'art';
/**
 * How the app uses the AI — fine-tuned DINOv2-small (2026-11-14) and the
 * « variant A » recognition validated on 2026-11-17 (lot 1.4, model/MODELS.md):
 *   the colours first; when they are not sure, the AI on the crop of the
 *   colours' best card, both ways up (2 model images, 168 × 168), scored over
 *   the whole catalog: score = ALPHA · AI + (1 − ALPHA) · colours.
 *   Thresholds of that score per detector input size (camera 320, photo 416),
 *   calibrated for the epoch-40 detector at ≤ 1 % of out-of-catalog cards
 *   accepted, minimum score the highest that loses no real photo
 *   (npm run eval:detector -- --camera …, recognition-report --fixed).
 *   They hold for ONE detector: its SHA-256 is written next to them, and the
 *   app accepts nothing automatically with another one (cardMatcher.fusedDecision).
 *   --t320 abs,margin / --t416 abs,margin: other thresholds; --detector: other file.
 */
const ALPHA = 0.5;
const DECISION = {
  320: opt('t320') ? pair(opt('t320')) : { abs: 0.457, margin: 0.15 },
  416: opt('t416') ? pair(opt('t416')) : { abs: 0.467, margin: 0.115 },
};
const DETECTOR_FILE = path.resolve(root, opt('detector', 'public/models/yolo11s-pose-riftbound-dyn.onnx'));
const detectorSha256 = crypto.createHash('sha256').update(fs.readFileSync(DETECTOR_FILE)).digest('hex');

const catalogFile = path.join(root, 'public', 'card-hashes.json');
const modelFile = MODEL_PATH || path.join(root, 'public', 'models', MODEL);
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const modelBytes = fs.readFileSync(modelFile);
const modelSha256 = crypto.createHash('sha256').update(modelBytes).digest('hex');

const cacheDir = path.join(root, 'model', 'cache');
const cacheFile = path.join(cacheDir, `embeddings-${ENGINE}-${REGION}-${modelSha256.slice(0, 12)}.json`);
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};

const engine = createOnnxEngine(ENGINE, ENGINE_CONFIGS[ENGINE]);
await engine.init({ ort, model: modelFile, executionProviders: ['cpu'] });

let computed = 0;
const t0 = Date.now();
for (const card of catalog.cards) {
  const bottom = typeof card.artBottom === 'number' ? card.artBottom : 0.55;
  const key = `${card.id}@${bottom}`;
  if (!cache[key]) {
    const img = path.join(root, 'public', 'cards', `${card.id}.webp`);
    if (!fs.existsSync(img)) throw new Error(`Image absente : ${img}`);
    const { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    cache[key] = encodeEmbedding(await engine.embedCatalog(data, info.width, info.height, { region: REGION, bottom }));
    computed++;
    if (computed % 100 === 0) process.stdout.write(`  ${computed} cartes (${Math.round((Date.now() - t0) / 1000)} s)\r`);
  }
  card.e = cache[key];
}
fs.mkdirSync(cacheDir, { recursive: true });
fs.writeFileSync(cacheFile, JSON.stringify(cache));

// Date of this catalog: the phone ignores an older one received from the PC (catalogChoice.js)
catalog.generatedAt = new Date().toISOString();
catalog.embeddings = {
  engine: ENGINE, region: REGION, model: MODEL, modelSha256, dim: engine.dim,
  views: ['normal', 'rot180'], alpha: ALPHA, decision: DECISION,
  detector: path.basename(DETECTOR_FILE), detectorSha256,
};
const outFile = path.resolve(root, opt('out', catalogFile));
fs.writeFileSync(outFile, JSON.stringify(catalog));
console.log(`→ ${path.relative(root, outFile)}`);
console.log(`✓ Signatures IA : ${catalog.cards.length} cartes (${computed} calculées, ${catalog.cards.length - computed} en cache), modèle ${MODEL} ${modelSha256.slice(0, 12)}…, détecteur ${detectorSha256.slice(0, 12)}…`);
