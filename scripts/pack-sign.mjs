/**
 * npm run pack:sign -- <contenu-AAAA-MM-JJ.rbpack> [--key <file>] [--out <file>]
 * Signs a content pack exported by the PC app (Réglages → Contenu → « Exporter
 * mon contenu ») with the private key of `npm run pack:keygen` — its
 * passphrase is asked in the terminal (CORRECTIONS-v3 B.2) — then checks the
 * signature with the app's public keys (electron/packPublicKey.json).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { askSecret } from './lib/askSecret.mjs';

const require = createRequire(import.meta.url);
const { signPack, readZip, verifyManifest, isEncryptedKey, loadPrivateKey, packKeys } = require('../electron/pack.cjs');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const fail = (msg) => { console.error(msg); process.exit(1); };
const file = process.argv.slice(2).find(a => !a.startsWith('--') && a !== arg('--key') && a !== arg('--out'));
if (!file || !existsSync(file)) fail('Usage : npm run pack:sign -- <pack.rbpack>');
const keyFile = resolve(arg('--key') || process.env.RB_PACK_KEY || join(homedir(), '.riftbound', 'pack-signing-key.pem'));
if (!existsSync(keyFile)) fail(`Clé privée introuvable : ${keyFile} (npm run pack:keygen, ou --key).`);
if (!existsSync('electron/packPublicKey.json')) fail('electron/packPublicKey.json manquant : npm run pack:keygen.');
const keys = packKeys(JSON.parse(readFileSync('electron/packPublicKey.json', 'utf8')));

const pem = readFileSync(keyFile, 'utf8');
let privateKey;
try {
  if (isEncryptedKey(pem)) privateKey = loadPrivateKey(pem, await askSecret('Phrase de passe de la clé des packs : '));
  else {
    console.warn('⚠ Clé privée en clair : protégez-la avec npm run pack:keygen -- --chiffrer.');
    privateKey = loadPrivateKey(pem);
  }
} catch (err) { fail(`Pack non signé : ${err.message}.`); }

const signed = signPack(readFileSync(file), privateKey);
const files = readZip(signed);
const signer = keys.find(k => verifyManifest(files['manifest.json'], files['manifest.sig'].toString('utf8'), k.publicKey));
if (!signer) fail('Cette clé privée ne correspond à aucune clé publique de l’appli : pack non signé.');
if (signer.revoked) fail(`Cette clé (${signer.fingerprint}) est révoquée : pack non signé.`);
const out = resolve(arg('--out') || file);
writeFileSync(out, signed);
const m = JSON.parse(files['manifest.json'].toString('utf8'));
console.log(`Pack signé ✓ (clé ${signer.fingerprint}) : ${out}`);
console.log(`Contenu : ${Object.entries(m.layers).map(([k, l]) => `${k} du ${String(l.createdAt).slice(0, 10)}`).join(', ')}`);
