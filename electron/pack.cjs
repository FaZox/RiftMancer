/**
 * Content packs (lot 4.5 of AMELIORATIONS-APPLI.md): one friend updates the
 * content, puts the pack on the shared Drive, the others import it — even
 * without Internet.
 *
 * A pack (contenu-<date>.rbpack) is a zip (stored, no compression: the images
 * are already WebP) holding:
 *   manifest.json   { kind: 'riftbound-pack', format: 1, createdAt, appVersion,
 *                     model: { modelSha256, detectorSha256 }, layers: { kind: { createdAt, count, source } },
 *                     files: { '<path>': sha256 } }
 *   manifest.sig    Ed25519 signature of manifest.json (base64), by the app's author
 *   couches/<kind>/layer.json, couches/cartes/cards/…webp
 *
 * Signed packs (decided): the author keeps the private key outside the
 * repository, encrypted with a passphrase (npm run pack:keygen, npm run
 * pack:sign); the app holds a LIST of public keys (electron/packPublicKey.json:
 * { keys: [{ publicKey, fingerprint, createdAt, revoked }] }, the former
 * { publicKey } still read) and accepts a pack signed by a key of the list
 * that is not revoked. It refuses a pack whose signature is missing or wrong,
 * made for another recognition model, older than the content in place, or
 * with an unexpected file.
 *
 * Reading (CORRECTIONS-v3 B.1): nothing is decompressed — a compressed entry
 * is refused — and the signature of the manifest is checked FIRST, reading
 * only manifest.json and manifest.sig; every other file is read only if the
 * signed manifest lists it. Pure Node: tests/pack.test.cjs.
 */
const crypto = require('node:crypto');
const { etx } = require('./i18n.cjs');
// Same detector, two SHA-256 (src/lib/scanRules.js, DETECTOR.sameWeights): only the file's description changed
const SAME_DETECTOR = { '980a89fd434d01cdbf33d095e649c006d76d4d7c51bcb02bbce048c48be5f0d1': '06df918b37a7dcb64305c5f4681d02f87904ffac6a67d30af14cbbd13d89f417' };
const canonDetector = (sha) => SAME_DETECTOR[sha] || sha || null;

const MAX_PACK = 600 * 1024 * 1024;
const MAX_ENTRIES = 12000;
const MAX_MANIFEST = 4 * 1024 * 1024;
const KINDS = ['cartes', 'traductions', 'bannies'];
const ENTRY = /^(manifest\.json|manifest\.sig|couches\/(cartes|traductions|bannies)\/layer\.json|couches\/cartes\/cards\/(thumbs\/)?[a-z0-9][a-z0-9-]{1,60}\.webp)$/;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ─── zip (stored entries only) ────────────────────────────────────────────
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** { name: Buffer } → zip Buffer (stored). */
function writeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const n = Buffer.from(name, 'utf8'), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data); centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/**
 * The entries of a zip, without reading their content: { name: { start, size } }.
 * Refuses (throws) a compressed entry, an entry outside the file, a duplicate,
 * an unexpected name, too many entries.
 */
function zipIndex(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error(etx('fichier illisible (ce n’est pas un pack)'));
  const count = buf.readUInt16LE(eocd + 10);
  if (count > MAX_ENTRIES) throw new Error('trop de fichiers');
  let p = buf.readUInt32LE(eocd + 16);
  const index = {};
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('fichier illisible');
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), real = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    if (p + 46 + nl > buf.length) throw new Error('fichier illisible');
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    p += 46 + nl + xl + cl;
    if (!ENTRY.test(name)) throw new Error(`fichier inattendu dans le pack (${name.slice(0, 80)})`);
    // The app only writes stored entries: a compressed one is never decompressed
    if (method !== 0 || size !== real) throw new Error(etx('format inattendu (fichier compressé)'));
    if (off + 30 > buf.length || buf.readUInt32LE(off) !== 0x04034b50) throw new Error('fichier illisible');
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    if (start + size > buf.length) throw new Error(etx('fichier tronqué ({name})', { name: name.slice(0, 80) }));
    if (index[name]) throw new Error('fichier en double dans le pack');
    index[name] = { start, size };
  }
  return index;
}
/** Content of one entry of zipIndex (a copy). */
const entryData = (buf, e) => Buffer.from(buf.subarray(e.start, e.start + e.size));

/** zip Buffer → { name: Buffer }. Throws on anything unexpected (see zipIndex). */
function readZip(buf) {
  const index = zipIndex(buf);
  return Object.fromEntries(Object.entries(index).map(([name, e]) => [name, entryData(buf, e)]));
}

// ─── Keys and signature ───────────────────────────────────────────────────

/** Ed25519 signature (base64) of the manifest bytes. `privateKey`: PEM or KeyObject. */
const signManifest = (manifestBytes, privateKey) => crypto.sign(null, manifestBytes, typeof privateKey === 'string' ? crypto.createPrivateKey(privateKey) : privateKey).toString('base64');
function verifyManifest(manifestBytes, sigB64, publicKeyPem) {
  try { return crypto.verify(null, manifestBytes, crypto.createPublicKey(publicKeyPem), Buffer.from(String(sigB64).trim(), 'base64')); } catch { return false; }
}
/** Short fingerprint of a public key (shown to check it is the right one). */
const keyFingerprint = (publicKeyPem) => sha256(crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' })).slice(0, 16);

/** Ed25519 key pair (PEM); the private key encrypted (AES-256) when a passphrase is given. */
function generateKeys(passphrase = null) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: passphrase
      ? privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase })
      : privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}
const isEncryptedKey = (pem) => /-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(String(pem));
/** The private key as a KeyObject; throws « phrase de passe incorrecte » when it does not open it. */
function loadPrivateKey(pem, passphrase = null) {
  if (isEncryptedKey(pem) && !passphrase) throw new Error('cette clé est protégée par une phrase de passe');
  try { return crypto.createPrivateKey(isEncryptedKey(pem) ? { key: pem, passphrase } : pem); } catch { throw new Error(isEncryptedKey(pem) ? 'phrase de passe incorrecte' : 'clé privée illisible'); }
}
/** A key in clear → the same key encrypted with the passphrase (public key unchanged). */
const encryptPrivateKey = (pem, passphrase) => loadPrivateKey(pem).export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase });
/** Public key (PEM) of a private key. */
const publicKeyOf = (privateKey) => crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });

/** electron/packPublicKey.json → [{ publicKey, fingerprint, createdAt, revoked }] (former { publicKey } format read too). */
function packKeys(json) {
  const list = Array.isArray(json?.keys) ? json.keys : json?.publicKey ? [json] : [];
  return list.filter(k => k?.publicKey).map(k => ({
    publicKey: k.publicKey, fingerprint: k.fingerprint || keyFingerprint(k.publicKey), createdAt: k.createdAt || null, revoked: k.revoked === true,
  }));
}

// ─── Building, signing, reading ───────────────────────────────────────────

/**
 * Pack of the active layers. `layers`: { kind: { json: Buffer (layer.json), files: { 'cards/…': Buffer } } }.
 * Unsigned: npm run pack:sign signs it (the app never holds the private key).
 */
function buildPack({ layers, model, appVersion, now = new Date() }) {
  const files = {}, summary = {};
  for (const [kind, l] of Object.entries(layers)) {
    if (!KINDS.includes(kind)) continue;
    files[`couches/${kind}/layer.json`] = l.json;
    for (const [rel, data] of Object.entries(l.files || {})) files[`couches/${kind}/${rel}`] = data;
    const j = JSON.parse(l.json.toString('utf8'));
    summary[kind] = { createdAt: j.createdAt, count: j.count ?? null, source: j.source || null };
  }
  if (!Object.keys(summary).length) throw new Error(etx('Rien à exporter : le contenu est celui d’origine.'));
  const manifest = {
    kind: 'riftbound-pack', format: 1, createdAt: now.toISOString(), appVersion, model, layers: summary,
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, sha256(v)])),
  };
  return writeZip({ 'manifest.json': Buffer.from(JSON.stringify(manifest, null, 1)), ...files });
}

/** Signs a pack (adds or replaces manifest.sig). `privateKey`: PEM in clear or KeyObject (loadPrivateKey). */
function signPack(buf, privateKey) {
  const files = readZip(buf);
  if (!files['manifest.json']) throw new Error('manifest.json manquant');
  const rest = { ...files };
  delete rest['manifest.sig'];
  return writeZip({ ...rest, 'manifest.sig': Buffer.from(signManifest(files['manifest.json'], privateKey)) });
}

/**
 * Reads and checks a pack. `publicKeys`: packKeys() of the app (or
 * `publicKeyPem`: one key, former call). `current`: { model: { modelSha256,
 * detectorSha256 }, layers: { kind: createdAt } } of this app. Returns
 * { manifest, layers: { kind: { layer, files } }, newer: [kinds], signed: true,
 * signedBy: fingerprint } or throws with the exact reason (B.6.2: « signature
 * invalide », « pack plus ancien que votre contenu », « fait pour un autre
 * modèle de reconnaissance »).
 */
function readPack(buf, { publicKeys = null, publicKeyPem = null, current }) {
  if (!Buffer.isBuffer(buf) || buf.length > MAX_PACK) throw new Error(etx('Pack refusé : fichier trop gros.'));
  const keys = publicKeys || (publicKeyPem ? [{ publicKey: publicKeyPem, fingerprint: keyFingerprint(publicKeyPem), revoked: false }] : []);
  let index;
  try { index = zipIndex(buf); } catch (err) { throw new Error(etx('Pack refusé : {message}.', { message: err.message })); }
  // 1. the signature, from manifest.json and manifest.sig only
  if (!index['manifest.json']) throw new Error(etx('Pack refusé : manifeste manquant.'));
  if (!keys.some(k => !k.revoked)) throw new Error(etx('Pack refusé : cette version de l’appli n’a pas de clé pour vérifier les packs.'));
  if (!index['manifest.sig']) throw new Error(etx('Pack refusé : il n’est pas signé.'));
  if (index['manifest.json'].size > MAX_MANIFEST || index['manifest.sig'].size > 4096) throw new Error(etx('Pack refusé : manifeste trop gros.'));
  const mBytes = entryData(buf, index['manifest.json']);
  const sig = entryData(buf, index['manifest.sig']).toString('utf8');
  const signer = keys.find(k => verifyManifest(mBytes, sig, k.publicKey));
  if (!signer) throw new Error(etx('Pack refusé : signature invalide.'));
  if (signer.revoked) throw new Error(etx('Pack refusé : signé par une clé révoquée ({fingerprint}).', { fingerprint: signer.fingerprint }));
  let m;
  try { m = JSON.parse(mBytes.toString('utf8')); } catch { throw new Error(etx('Pack refusé : manifeste illisible.')); }
  if (m.kind !== 'riftbound-pack' || m.format !== 1) throw new Error(etx('Pack refusé : format inconnu (appli trop ancienne ?).'));
  if (m.model?.modelSha256 !== current.model?.modelSha256 || canonDetector(m.model?.detectorSha256) !== canonDetector(current.model?.detectorSha256)) {
    throw new Error(etx('Pack refusé : fait pour un autre modèle de reconnaissance (mettez l’appli à jour).'));
  }
  // 2. the other files: listed by the signed manifest before being read
  const listed = m.files || {};
  const files = {};
  for (const name of Object.keys(index)) {
    if (name === 'manifest.json' || name === 'manifest.sig') continue;
    if (!listed[name]) throw new Error(etx('Pack refusé : fichier non listé ({name}).', { name }));
    const data = entryData(buf, index[name]);
    if (sha256(data) !== listed[name]) throw new Error(etx('Pack refusé : fichier altéré ({name}).', { name }));
    files[name] = data;
  }
  for (const name of Object.keys(listed)) if (!files[name]) throw new Error(etx('Pack refusé : fichier manquant ({name}).', { name }));
  const layers = {};
  for (const kind of KINDS) {
    const json = files[`couches/${kind}/layer.json`];
    if (!json) continue;
    let layer;
    try { layer = JSON.parse(json.toString('utf8')); } catch { throw new Error(etx('Pack refusé : {kind} illisible.', { kind })); }
    const own = {};
    const prefix = `couches/${kind}/`;
    for (const name of Object.keys(files)) if (name.startsWith(prefix) && name !== `${prefix}layer.json`) own[name.slice(prefix.length)] = files[name];
    const rest = { ...layer };
    delete rest.files; // recomputed when installed (content.cjs)
    layers[kind] = { layer: rest, files: own };
  }
  const newer = Object.keys(layers).filter(k => !current.layers?.[k] || layers[k].layer.createdAt > current.layers[k]);
  if (!Object.keys(layers).length) throw new Error(etx('Pack refusé : il est vide.'));
  if (!newer.length) throw new Error(etx('Pack refusé : pack plus ancien que votre contenu (ou déjà importé).'));
  return { manifest: m, layers, newer, signed: true, signedBy: signer.fingerprint };
}

module.exports = {
  buildPack, signPack, readPack, generateKeys, keyFingerprint, writeZip, readZip, zipIndex, signManifest, verifyManifest,
  isEncryptedKey, loadPrivateKey, encryptPrivateKey, publicKeyOf, packKeys, canonDetector,
};
