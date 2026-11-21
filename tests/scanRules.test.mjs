// Lot 1.4 (AMELIORATIONS-APPLI.md): one recognition chain. Thresholds in the
// catalog header, tied to the detector's SHA-256; the camera rule for every app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const { DETECTOR, setScanSize, scanSizeKey, cameraAutoAccept, MODE_SIZES_KEY } = await import('../src/lib/scanRules.js');
const { default: CardMatcher } = await import('../src/lib/cardMatcher.js');
const { DECISION_PRUDENT } = await import('../src/lib/matchIndex.js');
const { chooseCatalog } = await import('../src/lib/catalogChoice.js');
const { MODE_SIZES, MODEL_URL } = await import('../src/lib/yoloDetector.js');

const header = {
  decision: { 320: { abs: 0.457, margin: 0.15 }, 416: { abs: 0.467, margin: 0.115 } },
  detectorSha256: DETECTOR.sha256,
};

test('thresholds of the fused score follow the input size (camera 320, photo 416)', () => {
  const m = new CardMatcher();
  setScanSize(320);
  assert.equal(scanSizeKey(), 320);
  assert.deepEqual(m.fusedDecision(header), { ...DECISION_PRUDENT, abs: 0.457, margin: 0.15 });
  setScanSize(416);
  assert.deepEqual(m.fusedDecision(header), { ...DECISION_PRUDENT, abs: 0.467, margin: 0.115 });
  assert.deepEqual(MODE_SIZES_KEY, MODE_SIZES);
  assert.equal(MODEL_URL, DETECTOR.url);
});

test('thresholds made for another detector: nothing accepted automatically', () => {
  const m = new CardMatcher();
  const other = { ...header, detectorSha256: 'f'.repeat(64) };
  assert.equal(m.fusedDecision(other).abs, Infinity);
  assert.equal(m.fusedDecision({ decision: header.decision }).abs, Infinity, 'older header without detector');
  m.benchSameThresholds = true; // benches measure other detectors with the shipped thresholds
  assert.equal(m.fusedDecision(other).abs, 0.467);
});

test('camera: a card under 2 % of the frame is asked, in every app now', () => {
  const ok = { accepted: true, level: 'sure' };
  const small = [[0, 0], [10, 0], [10, 14], [0, 14]]; // 140 px² of 100 × 100 = 1.4 %
  const big = [[0, 0], [20, 0], [20, 28], [0, 28]];   // 5.6 %
  assert.deepEqual(cameraAutoAccept(ok, small, 100, 100), { accepted: false, level: 'uncertain', smallCard: true });
  assert.equal(cameraAutoAccept(ok, big, 100, 100), ok);
});

test('phone: a PC catalog made for another detector is not used', () => {
  const cards = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` }));
  const emb = (det) => ({ modelSha256: 'a'.repeat(64), detectorSha256: det });
  const bundled = { generatedAt: '2026-11-17', embeddings: emb(DETECTOR.sha256), cards };
  const r = chooseCatalog(bundled, { generatedAt: '2026-12-01', embeddings: emb('b'.repeat(64)), cards });
  assert.deepEqual(r, { use: 'bundled', reason: 'seuils faits pour un autre détecteur' });
  assert.equal(chooseCatalog(bundled, { generatedAt: '2026-12-01', embeddings: emb(DETECTOR.sha256), cards }).use, 'downloaded');
});

test('same detector, two SHA-256: the shipped file and the former one (same weights, description cleaned)', async () => {
  const { DETECTOR, sameDetector } = await import('../src/lib/scanRules.js');
  const { createHash } = await import('node:crypto');
  const { readFileSync, existsSync } = await import('node:fs');
  const model = new URL('../public/models/yolo11s-pose-riftbound-dyn.onnx', import.meta.url);
  const head = existsSync(model) ? readFileSync(model).subarray(0, 40).toString('latin1') : '';
  if (head && !head.startsWith('version https://git-lfs')) {
    assert.equal(createHash('sha256').update(readFileSync(model)).digest('hex'), DETECTOR.sha256, 'the shipped file');
    assert.ok(!readFileSync(model).toString('latin1').includes('Users'), 'no path of a PC in the metadata');
  }
  for (const old of DETECTOR.sameWeights) {
    assert.ok(sameDetector(old), 'a catalog made for the former SHA-256 keeps its thresholds');
    assert.ok(sameDetector(DETECTOR.sha256, old));
  }
  assert.ok(!sameDetector('0'.repeat(64)), 'another detector');
  assert.ok(!sameDetector(null));
  const pack = readFileSync(new URL('../electron/pack.cjs', import.meta.url), 'utf8');
  for (const old of DETECTOR.sameWeights) assert.ok(pack.includes(`'${old}': '${DETECTOR.sha256}'`), 'packs: same list (electron/pack.cjs)');
});
