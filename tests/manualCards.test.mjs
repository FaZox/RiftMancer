// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
/* Manual additions to the catalog (model/manual_cards.py): added, marked, no price, removed once official. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { buildPriceTable } from '../src/lib/priceBuilder.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Third-party modules imported by model/cards_scraper.py and model/manual_cards.py (checked by the last test)
const PY_MODULES = ['cv2', 'numpy', 'PIL', 'requests', 'tqdm'];
/** Why the Python tests cannot run here (Python or a module missing), or false. */
function pythonMissing() {
  const code = `import importlib.util\nm = [n for n in ${JSON.stringify(PY_MODULES)} if importlib.util.find_spec(n) is None]\nprint(','.join(m))`;
  const r = spawnSync('python', ['-c', code], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return 'Python absent';
  const missing = r.stdout.trim();
  return missing ? `module Python manquant : ${missing.split(',').join(', ')}` : false;
}
const skipPython = pythonMissing();

async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-manual-'));
  const cards = path.join(dir, 'cards');
  const manual = path.join(dir, 'manual');
  fs.mkdirSync(cards);
  fs.mkdirSync(manual);
  await sharp({ create: { width: 744, height: 1039, channels: 3, background: { r: 40, g: 120, b: 60 } } }).webp().toFile(path.join(cards, 'ven-r02.webp'));
  await sharp({ create: { width: 744, height: 1039, channels: 3, background: { r: 200, g: 150, b: 90 } } }).webp().toFile(path.join(manual, 'tok.webp'));
  fs.writeFileSync(path.join(dir, 'card-hashes.json'), JSON.stringify({
    gridSize: 16,
    cards: [{ id: 'ven-r02', name: 'Calm Rune', code: 'VEN-R02', set: 'VEN', number: 2, type: 'rune', f: 'x' }],
  }));
  const entry = (id, code, image) => ({ id, code, set: code.slice(0, 3), setName: 'S', number: 2, name: 'Calm Rune', nameFr: 'Rune de calme', type: 'rune', domains: ['calm'], image });
  fs.writeFileSync(path.join(manual, 'manual-cards.json'), JSON.stringify({
    cards: [entry('unl-r02', 'UNL-R02', { fromCard: 'ven-r02' }), entry('sfd-t02', 'SFD-T02', { file: 'tok.webp' })],
  }));
  const run = () => spawnSync('python', [path.join(root, 'model', 'manual_cards.py')], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', RB_MANUAL_DIR: manual, RB_CATALOG: path.join(dir, 'card-hashes.json'), RB_CARDS_DIR: cards },
  });
  const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  return { dir, cards, manual, run, catalog: () => read(path.join(dir, 'card-hashes.json')), manualList: () => read(path.join(manual, 'manual-cards.json')) };
}

test('manual cards: added once (marked, fingerprint, image), idempotent', { skip: skipPython }, async () => {
  const t = await setup();
  for (let k = 0; k < 2; k++) {
    const r = t.run();
    assert.equal(r.status, 0, r.stderr);
  }
  const cards = t.catalog().cards;
  assert.equal(cards.length, 3);
  const m = cards.filter(c => c.manual).map(c => c.id).sort();
  assert.deepEqual(m, ['sfd-t02', 'unl-r02']);
  assert.equal(cards.find(c => c.id === 'unl-r02').f.length, 1024);
  assert.ok(fs.existsSync(path.join(t.cards, 'sfd-t02.webp')));
});

test('manual card removed (with a log message) once the official gallery has its code', { skip: skipPython }, async () => {
  const t = await setup();
  t.run();
  // the official gallery now publishes SFD-T02
  const cat = t.catalog();
  cat.cards = cat.cards.filter(c => !c.manual);
  cat.cards.push({ id: 'sfd-t02', name: 'Sand Soldier', code: 'SFD-T02', set: 'SFD', number: 2, type: 'unit', f: 'y' });
  fs.writeFileSync(path.join(t.dir, 'card-hashes.json'), JSON.stringify(cat));
  const r = t.run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /SFD-T02 est maintenant publiée par la galerie officielle/);
  assert.deepEqual(t.manualList().cards.map(c => c.id), ['unl-r02']);
  assert.ok(!fs.existsSync(path.join(t.manual, 'tok.webp')));
  const sfd = t.catalog().cards.filter(c => c.id === 'sfd-t02');
  assert.equal(sfd.length, 1);
  assert.equal(sfd[0].manual, undefined);
});

test('manual cards get no price', () => {
  const catalog = [
    { id: 'ven-r02', name: 'Calm Rune', code: 'VEN-R02', set: 'VEN' },
    { id: 'unl-r02', name: 'Calm Rune', code: 'UNL-R02', set: 'UNL', manual: true },
  ];
  const products = { products: [{ idProduct: 1, idExpansion: 10, name: 'Calm Rune' }, { idProduct: 2, idExpansion: 11, name: 'Calm Rune' }] };
  const guide = { priceGuides: [{ idProduct: 1, trend: 0.2 }, { idProduct: 2, trend: 0.3 }] };
  const table = buildPriceTable(catalog, products, guide, {}, null);
  const ids = Object.keys(table.cards || table);
  assert.ok(!ids.includes('unl-r02'), JSON.stringify(table).slice(0, 200));
});

test('the Python modules checked are exactly the third-party imports of the two scripts', () => {
  const STDLIB = new Set(['os', 're', 'sys', 'base64', 'json', 'shutil', 'sqlite3', 'io', 'concurrent', 'argparse', 'math', 'time', 'pathlib', 'hashlib', 'datetime', 'urllib', 'collections', 'functools', 'itertools', 'typing']);
  const LOCAL = new Set(['cards_scraper', 'manual_cards']);
  const imports = new Set();
  for (const f of ['cards_scraper.py', 'manual_cards.py']) {
    for (const line of fs.readFileSync(path.join(root, 'model', f), 'utf8').split(/\r?\n/)) {
      const m = /^(?:import|from)\s+([A-Za-z_][\w]*)/.exec(line);
      if (m && !STDLIB.has(m[1]) && !LOCAL.has(m[1])) imports.add(m[1]);
    }
  }
  assert.deepEqual([...imports].sort(), [...PY_MODULES].sort());
});
