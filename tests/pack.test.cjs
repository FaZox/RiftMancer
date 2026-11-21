/* Lot 4.5: signed content packs (electron/pack.cjs). Test keys only, made here. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createContent } = require('../electron/content.cjs');
const P = require('../electron/pack.cjs');

const keys = P.generateKeys();
const other = P.generateKeys();
const model = { modelSha256: 'm'.repeat(64), detectorSha256: 'd'.repeat(64) };

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-pack-'));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(dist, 'card-hashes.json'), JSON.stringify({ generatedAt: '2026-11-17T00:00:00.000Z', cards: [{ id: 'ogn-001-298', name: 'A', f: 'x' }] }));
  fs.writeFileSync(path.join(dist, 'banlist.json'), JSON.stringify({ version: 2, updatedAt: '2026-11-17', formats: { standard: { banned: [{ name: 'A' }] } } }));
  return createContent({ dir: path.join(root, 'catalogue'), distDir: dist });
}
const newCard = { id: 'vnd-001-221', name: 'New', setName: 'Vendetta', f: 'y' };
function exported(createdAt = '2026-11-18T10:00:00.000Z') {
  const a = setup();
  a.install('cartes', { createdAt, source: { label: 'galerie officielle Riot' }, count: 1, data: { cards: [newCard] } }, { 'cards/vnd-001-221.webp': Buffer.from('IMG') });
  a.install('bannies', { createdAt, data: { version: 2, updatedAt: '2026-11-23', formats: { standard: { banned: [{ name: 'A' }, { name: 'B' }] } } } });
  return P.buildPack({ layers: a.exportLayers(), model, appVersion: '2.1.0', now: new Date(createdAt) });
}
const current = (content) => ({ model, layers: content.layerDates() });

test('round trip: export → sign → import on another PC, image and lists in place', () => {
  const signed = P.signPack(exported(), keys.privateKey);
  const b = setup();
  const pack = P.readPack(signed, { publicKeyPem: keys.publicKey, current: current(b) });
  assert.deepEqual(pack.newer.sort(), ['bannies', 'cartes']);
  assert.equal(pack.manifest.appVersion, '2.1.0');
  const s = b.importLayers(pack.layers, pack.newer);
  assert.equal(s.cards, 2);
  assert.equal(s.banlist.updatedAt, '2026-11-23');
  assert.equal(fs.readFileSync(b.resolve('/cards/vnd-001-221.webp'), 'utf8'), 'IMG');
});

test('refused: unsigned, signed by someone else, altered file, altered manifest', () => {
  const b = setup();
  const opts = { publicKeyPem: keys.publicKey, current: current(b) };
  assert.throws(() => P.readPack(exported(), opts), /n’est pas signé/);
  assert.throws(() => P.readPack(P.signPack(exported(), other.privateKey), opts), /signature invalide/);
  const files = P.readZip(P.signPack(exported(), keys.privateKey));
  assert.throws(() => P.readPack(P.writeZip({ ...files, 'couches/cartes/cards/vnd-001-221.webp': Buffer.from('EVIL') }), opts), /fichier altéré/);
  const m = JSON.parse(files['manifest.json']); m.appVersion = '9.9.9';
  assert.throws(() => P.readPack(P.writeZip({ ...files, 'manifest.json': Buffer.from(JSON.stringify(m)) }), opts), /signature invalide/);
  assert.throws(() => P.readPack(P.writeZip({ ...files, 'couches/cartes/cards/extra-001.webp': Buffer.from('x') }), opts), /fichier non listé/);
  assert.throws(() => P.readPack(P.signPack(exported(), keys.privateKey), { ...opts, publicKeyPem: null }), /pas de clé pour vérifier/);
});

test('refused: file names with « .. » or unexpected paths, not a zip', () => {
  const opts = { publicKeyPem: keys.publicKey, current: current(setup()) };
  for (const name of ['couches/cartes/../../evil.webp', 'couches/cartes/cards/a.exe', '../manifest.json', 'autre/layer.json']) {
    assert.throws(() => P.readPack(P.writeZip({ 'manifest.json': Buffer.from('{}'), [name]: Buffer.from('x') }), opts), /fichier inattendu/, name);
  }
  assert.throws(() => P.readPack(Buffer.from('pas un zip'), opts), /ce n’est pas un pack/);
});

test('refused: made for another recognition model, older than the content in place', () => {
  const b = setup();
  const signed = P.signPack(exported(), keys.privateKey);
  assert.throws(() => P.readPack(signed, { publicKeyPem: keys.publicKey, current: { model: { ...model, modelSha256: 'z'.repeat(64) }, layers: {} } }), /autre modèle de reconnaissance/);
  const pack = P.readPack(signed, { publicKeyPem: keys.publicKey, current: current(b) });
  b.importLayers(pack.layers, pack.newer);
  assert.throws(() => P.readPack(signed, { publicKeyPem: keys.publicKey, current: current(b) }), /plus ancien que votre contenu/, 'same pack again');
  const older = P.signPack(exported('2026-11-17T12:00:00.000Z'), keys.privateKey);
  assert.throws(() => P.readPack(older, { publicKeyPem: keys.publicKey, current: current(b) }), /plus ancien/);
});

test('nothing to export from the original content; key fingerprint stable', () => {
  assert.throws(() => P.buildPack({ layers: setup().exportLayers(), model, appVersion: '2.1.0' }), /Rien à exporter/);
  assert.equal(P.keyFingerprint(keys.publicKey), P.keyFingerprint(keys.publicKey));
  assert.notEqual(P.keyFingerprint(keys.publicKey), P.keyFingerprint(other.publicKey));
  assert.match(keys.privateKey, /BEGIN PRIVATE KEY/);
});

// ─── CORRECTIONS-v3 B.1: nothing decompressed, signature checked before the rest ───

/** A zip whose central entry `name` is made compressed (method 8), lengths kept. */
function withCompressedEntry(zip, name) {
  const buf = Buffer.from(zip);
  const n = Buffer.from(name);
  for (let p = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); p >= 0; p = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), p - 1)) {
    if (buf.subarray(p + 46, p + 46 + n.length).equals(n)) { buf.writeUInt16LE(8, p + 10); return buf; }
  }
  throw new Error('entry not found');
}

test('B.1 · a compressed entry is refused without being decompressed', () => {
  const b = setup();
  const signed = P.signPack(exported(), keys.privateKey);
  const zlib = require('node:zlib');
  const inflate = zlib.inflateRawSync;
  let calls = 0;
  zlib.inflateRawSync = (...a) => { calls++; return inflate(...a); };
  try {
    assert.throws(() => P.readPack(withCompressedEntry(signed, 'couches/cartes/cards/vnd-001-221.webp'), { publicKeyPem: keys.publicKey, current: current(b) }), /format inattendu/);
    assert.equal(calls, 0, 'nothing decompressed');
  } finally { zlib.inflateRawSync = inflate; }
});

test('B.1 · an unsigned pack of 1 000 entries is refused after reading the manifest only', () => {
  const b = setup();
  const files = { 'manifest.json': Buffer.from('{}') };
  for (let i = 0; i < 1000; i++) files[`couches/cartes/cards/x${String(i).padStart(4, '0')}.webp`] = Buffer.alloc(1024, 7);
  const zip = P.writeZip(files);
  const copy = Buffer.from;
  let copied = 0;
  Buffer.from = function (x, ...rest) { if (x instanceof Uint8Array && x.length === 1024) copied++; return copy.call(Buffer, x, ...rest); };
  try {
    assert.throws(() => P.readPack(zip, { publicKeyPem: keys.publicKey, current: current(b) }), /n’est pas signé/);
  } finally { Buffer.from = copy; }
  assert.equal(copied, 0, 'none of the 1 000 files read');
  // signed by another key: refused the same way, before the files
  assert.throws(() => P.readPack(P.signPack(exported(), other.privateKey), { publicKeyPem: keys.publicKey, current: current(b) }), /signature invalide/);
});

test('B.1 · an entry going past the end of the file is refused', () => {
  const b = setup();
  const signed = P.signPack(exported(), keys.privateKey);
  // the central directory says the manifest is 1 MB long: past the end of the file
  const evil = Buffer.from(signed);
  const p = evil.lastIndexOf(Buffer.from('manifest.json')) - 46;
  assert.equal(evil.readUInt32LE(p), 0x02014b50, 'central entry of the manifest');
  evil.writeUInt32LE(1024 * 1024, p + 20); evil.writeUInt32LE(1024 * 1024, p + 24);
  assert.throws(() => P.readPack(evil, { publicKeyPem: keys.publicKey, current: current(b) }), /tronqué/);
});

// ─── CORRECTIONS-v3 B.2: encrypted private key, list of public keys, revocation ───

test('B.2 · encrypted key: signs with the right passphrase, refused with a wrong one', () => {
  const b = setup();
  const enc = P.generateKeys('une phrase de passe assez longue');
  assert.ok(P.isEncryptedKey(enc.privateKey));
  assert.throws(() => P.loadPrivateKey(enc.privateKey, 'mauvaise phrase'), /phrase de passe incorrecte/);
  assert.throws(() => P.loadPrivateKey(enc.privateKey), /protégée par une phrase de passe/);
  const signed = P.signPack(exported(), P.loadPrivateKey(enc.privateKey, 'une phrase de passe assez longue'));
  assert.equal(P.readPack(signed, { publicKeyPem: enc.publicKey, current: current(b) }).signed, true);
  // a key in clear, encrypted afterwards: same key
  const again = P.encryptPrivateKey(keys.privateKey, 'autre phrase de passe 123');
  assert.ok(P.isEncryptedKey(again));
  assert.equal(P.publicKeyOf(P.loadPrivateKey(again, 'autre phrase de passe 123')), P.publicKeyOf(P.loadPrivateKey(keys.privateKey)));
});

test('B.2 · list of keys: a 2nd key accepted, a revoked key refused, the former format still read', () => {
  const b = setup();
  const list = P.packKeys({ keys: [
    { publicKey: keys.publicKey, createdAt: '2026-11-18', revoked: true },
    { publicKey: other.publicKey, createdAt: '2026-11-21', revoked: false },
  ] });
  const byOther = P.readPack(P.signPack(exported(), other.privateKey), { publicKeys: list, current: current(b) });
  assert.equal(byOther.signedBy, P.keyFingerprint(other.publicKey));
  assert.throws(() => P.readPack(P.signPack(exported(), keys.privateKey), { publicKeys: list, current: current(b) }), /clé révoquée/);
  const former = P.packKeys({ publicKey: keys.publicKey, fingerprint: P.keyFingerprint(keys.publicKey), createdAt: '2026-11-18' });
  assert.equal(former.length, 1);
  assert.equal(former[0].revoked, false);
  assert.equal(P.readPack(P.signPack(exported(), keys.privateKey), { publicKeys: former, current: current(b) }).signed, true);
  assert.throws(() => P.readPack(P.signPack(exported(), keys.privateKey), { publicKeys: [], current: current(b) }), /pas de clé/);
});
