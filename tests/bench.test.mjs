// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
/*
 * Bench collection of the app (MODULE-BANC.md 5): golden rule (no card
 * without a human label), names never colliding, _collecte.json merged, GPS
 * removed from the photos, and an exported ZIP read as is by the bench
 * scripts (scripts/eval-detector.mjs, scripts/photos-prepare.mjs — run
 * unmodified on a copy of the exported tree).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { zipStore, readZipStore, ZipWriter, crc32 } from '../src/lib/bench/zip.js';
import { stripJpegMetadata, jpegExifInfo, isJpeg } from '../src/lib/bench/jpegClean.js';
import {
  assertLabeled, labelFor, newPhotoName, NAME_RE, drawSplit, exportPlan, mergeCollecte, gridText,
  codeIndex, benchKey, normalizeFreeCode, isBenchPath, cardsSummary, collectStats, COLLECTE_FILE,
} from '../src/lib/bench/benchFormat.js';
import { importBenchZip } from '../scripts/lib/benchImport.mjs';
import { NO_LFS } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public', 'card-hashes.json'), 'utf8')).cards;
const index = codeIndex(catalog);
const byId = new Map(catalog.map(c => [c.id, c]));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), `rb-bench-${p}-`));

let seq = 0;
/** A labelled photo as the app saves it. */
function item(type, cards, extra = {}) {
  const d = new Date(2026, 10, 14, 16, 2, 33);
  return {
    name: newPhotoName(d, new Set(), () => Uint8Array.from([seq++, seq++, seq++, seq++])),
    type, source: 'photo', date: '2026-11-14T16:02:33', appVersion: '2.1.0',
    detector: 'yolo11s-pose-riftbound-dyn@416', engine: 'dinov2s-fp16-mean-168', thresholds: [0.42, 0.14],
    split: 'test', cards, rejectedBoxes: 0, ...extra,
  };
}
const idOf = (key) => (byId.has(key.toLowerCase()) ? key.toLowerCase() : index.byCode.get(key)?.[0] || null);
const card = (final, scanner, label, level = scanner ? 'sure' : null) => ({ final, finalId: idOf(final), scanner, level, label });

/** JPEG of a catalog card on a grey table, with a GPS position and a phone model (as a phone photo). */
async function phonePhoto(ids, { orientation } = {}) {
  const W = 620 * ids.length;
  const H = 820;
  const layers = [];
  for (let i = 0; i < ids.length; i++) {
    const c = await sharp(path.join(root, 'public', 'cards', `${ids[i]}.webp`)).resize(420).toBuffer();
    layers.push({ input: c, left: 100 + i * 620, top: 120 });
  }
  let img = sharp({ create: { width: W, height: H, channels: 3, background: '#6b6b6b' } }).composite(layers)
    .withExif({ IFD0: { Make: 'TestPhone', Model: 'X1' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '48/1 51/1 2400/100', GPSLongitudeRef: 'E', GPSLongitude: '2/1 21/1 0/1' } });
  if (orientation) img = img.withMetadata({ orientation });
  return new Uint8Array(await img.jpeg({ quality: 92 }).toBuffer());
}

// ─── Golden rule ───────────────────────────────────────────────────────
test('règle d’or : aucune carte enregistrée sans étiquette humaine', () => {
  assert.doesNotThrow(() => assertLabeled(item('carte', [card('OGN-042', 'OGN-042', 'confirmé')])));
  assert.doesNotThrow(() => assertLabeled(item('carte', [card('UNL-099', 'UNL-090', 'corrigé', 'probable')])));
  assert.doesNotThrow(() => assertLabeled(item('grille', [card('OGN-011', 'OGN-011', 'confirmé'), card('OGN-094', null, 'ajouté')])));
  const bad = [
    [card('OGN-042', 'OGN-042', undefined)],     // no label
    [card('OGN-042', 'OGN-042', 'accepté')],     // unknown label
    [{ ...card('OGN-042', 'OGN-042', 'confirmé'), label: null }],
    [card('OGN-042', 'OGN-041', 'confirmé')],    // « confirmed » but different
    [card('OGN-042', 'OGN-042', 'corrigé')],     // « corrected » but same
    [card('OGN-042', 'OGN-042', 'ajouté')],      // « added » though the scanner found it
    [card('OGN-042', null, 'confirmé')],         // confirmed without a scanner answer
    [card('', null, 'ajouté')],                  // no card
  ];
  for (const cards of bad) assert.throws(() => assertLabeled(item('carte', cards)), undefined, JSON.stringify(cards));
  assert.throws(() => assertLabeled(item('carte', [])));
  assert.throws(() => assertLabeled(item('carte', [card('OGN-042', 'OGN-042', 'confirmé'), card('OGN-043', 'OGN-043', 'confirmé')])));
  // the export checks every photo too
  assert.throws(() => exportPlan([item('carte', [card('OGN-042', 'OGN-042', undefined)])]), /pas encore confirmée/);
});

test('étiquette déduite de la réponse du scanner et de la carte choisie', () => {
  assert.equal(labelFor('OGN-042', 'OGN-042'), 'confirmé');
  assert.equal(labelFor('OGN-042', 'OGN-041'), 'corrigé');
  assert.equal(labelFor('OGN-042', null), 'ajouté');
  assert.equal(cardsSummary([
    ...Array(9).fill({ label: 'confirmé' }), ...Array(2).fill({ label: 'corrigé' }), { label: 'ajouté' },
  ]), '12 cartes : 9 confirmées, 2 corrigées, 1 ajoutée à la main');
});

// ─── Names and codes ───────────────────────────────────────────────────
test('noms de photos : format du banc, jamais deux fois le même', () => {
  const taken = new Set();
  const d = new Date(2026, 10, 14, 16, 2, 33);
  for (let i = 0; i < 3000; i++) taken.add(newPhotoName(d, taken));
  assert.equal(taken.size, 3000);
  for (const n of taken) assert.match(n, /^20261114_160233_[a-z0-9]{4}$/);
  // a random draw that keeps colliding still ends on a free name
  let k = 0;
  const stuck = () => Uint8Array.from(k++ < 8 ? [0, 0, 0, 0] : [1, 2, 3, 4]);
  const first = newPhotoName(d, new Set(), () => Uint8Array.from([0, 0, 0, 0]));
  assert.notEqual(newPhotoName(d, new Set([first]), stuck), first);
  assert.match(first, NAME_RE);
});

test('tirage test / calib fait une fois, ≈ 70 / 30', () => {
  let t = 0;
  for (let i = 0; i < 4000; i++) if (drawSplit() === 'test') t++;
  assert.ok(t / 4000 > 0.66 && t / 4000 < 0.74, `${t / 4000}`);
});

test('dossier d’une carte : code imprimé, ou identifiant quand le code ne suffit pas', () => {
  assert.equal(benchKey(byId.get('ogn-042-298'), index), 'OGN-042');
  assert.equal(benchKey(byId.get('ogn-299-star-298'), index), 'ogn-299-star-298'); // « OGN-299* »
  // ambiguous code: two cards share it
  const amb = codeIndex([{ id: 'abc-001-100', code: 'ABC-001/100' }, { id: 'abc-001-200', code: 'ABC-001/200' }]);
  assert.equal(benchKey({ id: 'abc-001-200', code: 'ABC-001/200' }, amb), 'abc-001-200');
  assert.equal(normalizeFreeCode(' sfd-t02 '), 'SFD-T02');
  // letter suffix: one spelling, the catalog's (Windows folders ignore the case)
  assert.equal(benchKey(byId.get('unl-150a-219'), index), 'UNL-150a');
  assert.equal(normalizeFreeCode('unl-150A'), 'UNL-150a');
  assert.ok(isBenchPath('UNL-150a/20261114_153012_a1b2.jpg'));
  assert.equal(normalizeFreeCode('OGN-042/298'), 'OGN-042');
  assert.equal(normalizeFreeCode('../etc'), null);
  assert.ok(isBenchPath('OGN-042/20261114_153012_a1b2.jpg'));
  assert.ok(isBenchPath('ogn-299-star-298/20261114_153012_a1b2.jpg'));
  assert.ok(isBenchPath('grilles/20261114_160233_e5f6.txt'));
  assert.ok(isBenchPath(COLLECTE_FILE));
  for (const p of ['../OGN-042/20261114_153012_a1b2.jpg', '/OGN-042/20261114_153012_a1b2.jpg', 'OGN-042/photo.jpg',
    'OGN-042/20261114_153012_a1b2.txt', 'OGN-042\\20261114_153012_a1b2.jpg', 'a/b/20261114_153012_a1b2.jpg']) {
    assert.ok(!isBenchPath(p), p);
  }
});

// ─── ZIP ───────────────────────────────────────────────────────────────
test('ZIP : relu à l’identique, et lisible par Windows', () => {
  const a = new Uint8Array(70000).map((_, i) => (i * 7) & 255);
  const zip = zipStore([{ name: 'OGN-042/x.jpg', data: a }, { name: 'grilles/é.txt', data: 'OGN-011\nOGN-011\n' }]);
  const back = readZipStore(zip);
  assert.deepEqual(back.map(f => f.name), ['OGN-042/x.jpg', 'grilles/é.txt']);
  assert.deepEqual([...back[0].data], [...a]);
  assert.equal(new TextDecoder().decode(back[1].data), 'OGN-011\nOGN-011\n');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const z = new ZipWriter();
  z.add('a.txt', 'x');
  assert.throws(() => z.add('a.txt', 'y'), /double/);
  assert.throws(() => z.add('../a.txt', 'y'), /invalide/);
  // tar.exe of Windows (bsdtar) reads ZIP files: the archive is valid for other tools too
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  if (process.platform === 'win32' && fs.existsSync(tar)) {
    const dir = tmp('zip');
    fs.writeFileSync(path.join(dir, 't.zip'), zip);
    const r = spawnSync(tar, ['-tf', path.join(dir, 't.zip')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /OGN-042\/x\.jpg/);
  }
});

// ─── EXIF ──────────────────────────────────────────────────────────────
test('EXIF : plus de position GPS ni d’appareil, orientation et image gardées', { skip: NO_LFS }, async () => {
  const photo = await phonePhoto(['ogn-042-298'], { orientation: 6 });
  const before = jpegExifInfo(photo);
  assert.ok(before.exif && before.gps, 'la photo de test doit contenir une position GPS');
  const { bytes, orientation } = stripJpegMetadata(photo);
  assert.ok(isJpeg(bytes));
  const after = jpegExifInfo(bytes);
  assert.equal(after.gps, false);
  assert.deepEqual(after.tags, [0x0112]); // orientation only
  assert.equal(orientation, 6);
  const meta = await sharp(Buffer.from(bytes)).metadata();
  assert.equal(meta.orientation, 6);
  assert.ok(!Buffer.from(bytes).includes('TestPhone'));
  // same picture, byte for byte decoded
  const [p1, p2] = await Promise.all([sharp(Buffer.from(photo)).raw().toBuffer(), sharp(Buffer.from(bytes)).raw().toBuffer()]);
  assert.ok(p1.equals(p2));
  // no orientation: no EXIF at all
  const plain = stripJpegMetadata(await phonePhoto(['ogn-042-298'])).bytes;
  assert.equal(jpegExifInfo(plain).exif, false);
  // pictures appended after the photo (depth map…) are dropped
  const withTrailer = new Uint8Array([...plain, ...photo]);
  assert.equal(stripJpegMetadata(withTrailer).bytes.length, plain.length);
  assert.throws(() => stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), /JPEG/);
});

// ─── Export tree, merge ────────────────────────────────────────────────
async function exportZip(items, photos) {
  const { files, entries } = exportPlan(items);
  const out = files.map(f => ({ name: f.path, data: f.kind === 'photo' ? photos.get(f.item.name) : f.text }));
  out.push({ name: COLLECTE_FILE, data: JSON.stringify(entries, null, 2) + '\n' });
  return zipStore(out);
}

test('arborescence du banc et fusion de _collecte.json sur deux exports', { skip: NO_LFS }, async () => {
  const jpeg = stripJpegMetadata(await phonePhoto(['ogn-042-298'])).bytes;
  const a = item('carte', [card('OGN-042', 'OGN-042', 'confirmé')]);
  const g = item('grille', [card('OGN-011', 'OGN-011', 'confirmé'), card('OGN-011', 'OGN-012', 'corrigé', 'uncertain'), card('UNL-T99', null, 'ajouté')], { rejectedBoxes: 1 });
  assert.equal(gridText(g), 'OGN-011\nOGN-011\nUNL-T99\n');
  const plan = exportPlan([a, g]);
  assert.deepEqual(plan.files.map(f => f.path), [`OGN-042/${a.name}.jpg`, `grilles/${g.name}.jpg`, `grilles/${g.name}.txt`]);
  assert.equal(plan.entries[1].rejectedBoxes, 1);
  assert.deepEqual(plan.entries[1].cards.map(c => c.label), ['confirmé', 'corrigé', 'ajouté']);
  assert.deepEqual(collectStats([a, g]), { photos: 2, grids: 1, cards: 4, corrected: 1, outside: 1 });

  const dest = tmp('merge');
  const r1 = importBenchZip(await exportZip([a, g], new Map([[a.name, jpeg], [g.name, jpeg]])), dest);
  assert.equal(r1.photos, 2);
  // second export: a new photo, and photo `a` corrected since (moved to another folder)
  const b = item('carte', [card('OGN-043', 'OGN-043', 'confirmé')], { source: 'camera' });
  const a2 = { ...a, cards: [card('OGN-041', 'OGN-042', 'corrigé')] };
  const r2 = importBenchZip(await exportZip([b, a2], new Map([[b.name, jpeg], [a.name, jpeg]])), dest);
  assert.deepEqual(r2.moved, [`OGN-042/${a.name}.jpg → OGN-041/${a.name}.jpg`]);
  const merged = JSON.parse(fs.readFileSync(path.join(dest, COLLECTE_FILE), 'utf8'));
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map(e => e.file).sort(), [`OGN-041/${a.name}.jpg`, `OGN-043/${b.name}.jpg`, `grilles/${g.name}.jpg`].sort());
  assert.ok(!fs.existsSync(path.join(dest, 'OGN-042', `${a.name}.jpg`)));
  assert.equal(fs.readFileSync(path.join(dest, 'grilles', `${g.name}.txt`), 'utf8'), 'OGN-011\nOGN-011\nUNL-T99\n');
  // the merge itself never drops an entry
  assert.equal(mergeCollecte(merged, [{ file: 'X-1/20261114_000000_zzzz.jpg' }]).length, 4);
});

test('import : un dossier existant garde sa casse, rien n’est « déplacé » pour une casse différente', { skip: NO_LFS }, async () => {
  const dest = tmp('case');
  const jpeg = stripJpegMetadata(await phonePhoto(['ogn-042-298'])).bytes;
  const a = item('carte', [card('OGN-042', 'OGN-042', 'confirmé')]);
  fs.mkdirSync(path.join(dest, 'UNL-150a'));
  // an older export wrote the photo under « UNL-150A »: same folder on Windows, another one elsewhere
  const name = a.name;
  const zip = zipStore([
    { name: `UNL-150A/${name}.jpg`, data: jpeg },
    { name: COLLECTE_FILE, data: JSON.stringify([{ ...exportPlan([a]).entries[0], file: `UNL-150A/${name}.jpg` }]) },
  ]);
  const r1 = importBenchZip(zip, dest);
  assert.deepEqual(r1.moved, []);
  assert.ok(fs.existsSync(path.join(dest, 'UNL-150a', `${name}.jpg`)));
  assert.deepEqual(fs.readdirSync(dest).filter(d => d.toLowerCase() === 'unl-150a'), ['UNL-150a']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dest, COLLECTE_FILE), 'utf8'))[0].file, `UNL-150a/${name}.jpg`);
  const r2 = importBenchZip(zip, dest); // again: still nothing moved, the photo kept
  assert.deepEqual(r2.moved, []);
  assert.ok(fs.existsSync(path.join(dest, 'UNL-150a', `${name}.jpg`)));
});

test('import refusé : chemin hors du banc, faux JPEG, photo avec GPS', { skip: NO_LFS }, async () => {
  const dest = tmp('refuse');
  const good = stripJpegMetadata(await phonePhoto(['ogn-042-298'])).bytes;
  const cases = [
    [{ name: '../evil/20261114_153012_a1b2.jpg', data: good }, /chemin refusé/],
    [{ name: 'OGN-042/autre.jpg', data: good }, /chemin refusé/],
    [{ name: 'OGN-042/20261114_153012_a1b2.jpg', data: new TextEncoder().encode('pas une image') }, /pas une photo JPEG/],
    [{ name: 'OGN-042/20261114_153012_a1b2.jpg', data: await phonePhoto(['ogn-042-298']) }, /GPS/],
  ];
  for (const [file, re] of cases) {
    let zip;
    try { zip = zipStore([file]); } catch { continue; } // the writer refuses « .. » itself
    assert.throws(() => importBenchZip(zip, dest), re);
  }
  assert.deepEqual(fs.readdirSync(dest), []); // nothing written
});

// ─── The bench scripts read an export as it is ─────────────────────────
const models = fs.existsSync(path.join(root, 'public', 'models', 'yolo11s-pose-riftbound-dyn.onnx'))
  && fs.existsSync(path.join(root, 'public', 'models', 'dinov2s-fp16.onnx'));

test('un export est lu sans avertissement par eval-detector.mjs et photos-prepare.mjs', { skip: !models && 'modèles absents (public/models)', timeout: 600000 }, async () => {
  const OUT = 'UNL-T99';
  assert.equal(index.byCode.has(OUT), false, `${OUT} doit être hors catalogue`);
  const one = stripJpegMetadata(await phonePhoto(['ogn-042-298'])).bytes;
  const star = stripJpegMetadata(await phonePhoto(['ogn-299-star-298'])).bytes;
  const grid = stripJpegMetadata(await phonePhoto(['ogn-011-298', 'ogn-011-298', 'unl-001-219'].filter(id => byId.has(id)))).bytes;
  const a = item('carte', [card('OGN-042', 'OGN-042', 'confirmé')]);
  const s = item('carte', [{ final: 'ogn-299-star-298', finalId: 'ogn-299-star-298', scanner: 'ogn-299-star-298', level: 'probable', label: 'confirmé' }]);
  const g = item('grille', [card('OGN-011', 'OGN-011', 'confirmé'), card('OGN-011', null, 'ajouté'), card(OUT, null, 'ajouté')]);

  // tree of the repository with the exported photos as model/real-photos-raw
  const mirror = tmp('mirror');
  for (const d of ['src', 'public', 'node_modules']) fs.symlinkSync(path.join(root, d), path.join(mirror, d), 'junction');
  fs.mkdirSync(path.join(mirror, 'scripts'));
  fs.copyFileSync(path.join(root, 'scripts', 'eval-detector.mjs'), path.join(mirror, 'scripts', 'eval-detector.mjs'));
  fs.mkdirSync(path.join(mirror, 'model', 'detector-eval'), { recursive: true });
  fs.writeFileSync(path.join(mirror, 'model', 'detector-eval', 'scenes.json'), '[]');
  const raw = path.join(mirror, 'model', 'real-photos-raw');
  importBenchZip(await exportZip([a, s, g], new Map([[a.name, one], [s.name, star], [g.name, grid]])), raw);

  const det = spawnSync(process.execPath, [path.join(mirror, 'scripts', 'eval-detector.mjs'), '--scenes', '0', '--threads', '1', '--models', 'public/models/yolo11s-pose-riftbound-dyn.onnx@416'],
    { cwd: mirror, encoding: 'utf8', timeout: 540000 });
  assert.equal(det.status, 0, det.stderr);
  assert.match(det.stdout, /0 scènes simulées, 2 photos réelles, 1 photos de grilles/);
  const warnings = det.stderr.split(/\r?\n/).filter(l => l.trim() && !/ExperimentalWarning|--trace-warnings|onnxruntime|^\s*at /i.test(l));
  assert.deepEqual(warnings, [`grille ${g.name}.jpg : hors catalogue ${OUT} (comptées pour la détection seulement)`]);
  const report = JSON.parse(fs.readFileSync(path.join(mirror, 'model', 'eval-detector.json'), 'utf8'));
  assert.equal(report.models[0].real.photos, 2);
  assert.equal(report.models[0].grids.photos, 1);
  assert.equal(report.models[0].grids.cards, 2); // 2 in the catalog + 1 outside (detection only)

  const out = tmp('prep');
  const prep = spawnSync(process.execPath, [path.join(root, 'scripts', 'photos-prepare.mjs'), '--in', raw, '--out', out], { encoding: 'utf8', timeout: 300000 });
  assert.equal(prep.status, 0, prep.stderr);
  assert.doesNotMatch(prep.stdout, /inconnue/);
  const done = Number(/(\d+) photo\(s\) recadrée/.exec(prep.stdout)?.[1]);
  const missed = Number(/Aucune carte détectée par YOLO \((\d+)\)/.exec(prep.stdout)?.[1] || 0);
  assert.equal(done + missed, 2, prep.stdout);
});
