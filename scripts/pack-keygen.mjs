/**
 * Keys of the signed content packs (lot 4.5, CORRECTIONS-v3 B.2) — by the app's author.
 *
 *   npm run pack:keygen                      first key, or a new key for a rotation (--out <file>)
 *   npm run pack:keygen -- --chiffrer        protects an existing key in clear with a passphrase
 *   npm run pack:keygen -- --revoquer <empreinte>   marks a public key revoked (next app version)
 *
 * The PRIVATE key stays in your user folder, OUTSIDE the repository
 * (%USERPROFILE%\.riftbound\pack-signing-key.pem, or --out), encrypted (AES-256)
 * with a passphrase typed twice in the terminal — never on disk, never in the
 * shell history. Keep a copy off the PC (USB key, password manager), like the
 * Android key.
 * The PUBLIC keys are in electron/packPublicKey.json (committed), as a list:
 * the app accepts a pack signed by any key of the list that is not revoked.
 * An existing private key is never overwritten.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { askNewPassphrase } from './lib/askSecret.mjs';

const require = createRequire(import.meta.url);
const { generateKeys, keyFingerprint, isEncryptedKey, encryptPrivateKey, loadPrivateKey, publicKeyOf, packKeys } = require('../electron/pack.cjs');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const KEYS_FILE = 'electron/packPublicKey.json';
const out = resolve(arg('--out') || join(homedir(), '.riftbound', 'pack-signing-key.pem'));
const today = () => new Date().toISOString().slice(0, 10);
const fail = (msg) => { console.error(msg); process.exit(1); };

const readKeys = () => (existsSync(KEYS_FILE) ? packKeys(JSON.parse(readFileSync(KEYS_FILE, 'utf8'))) : []);
const writeKeys = (keys) => writeFileSync(KEYS_FILE, JSON.stringify({ keys }, null, 2) + '\n');
// Written next to the target, then renamed: never half a key on disk
const writeKey = (file, pem) => { writeFileSync(`${file}.tmp`, pem, { mode: 0o600 }); renameSync(`${file}.tmp`, file); };

try {
  if (process.argv.includes('--revoquer')) {
    const fp = arg('--revoquer');
    const keys = readKeys();
    const k = keys.find(x => x.fingerprint === fp);
    if (!k) fail(`Aucune clé d’empreinte ${fp} dans ${KEYS_FILE}.`);
    if (!keys.some(x => x !== k && !x.revoked)) fail('C’est la seule clé valide : ajoutez d’abord la nouvelle (npm run pack:keygen -- --out <autre fichier>).');
    k.revoked = true;
    writeKeys(keys);
    console.log(`Clé ${fp} révoquée dans ${KEYS_FILE} : à commiter ; les applis de la prochaine version refuseront ses packs.`);
  } else if (process.argv.includes('--chiffrer')) {
    if (!existsSync(out)) fail(`Clé privée introuvable : ${out}`);
    const pem = readFileSync(out, 'utf8');
    if (isEncryptedKey(pem)) fail('Cette clé est déjà protégée par une phrase de passe.');
    const passphrase = await askNewPassphrase();
    const encrypted = encryptPrivateKey(pem, passphrase);
    // Check before replacing: the encrypted key opens with the passphrase and is the same key
    if (publicKeyOf(loadPrivateKey(encrypted, passphrase)) !== publicKeyOf(loadPrivateKey(pem))) fail('Vérification impossible : clé non remplacée.');
    writeKey(out, encrypted);
    console.log(`Clé protégée par la phrase de passe : ${out} (empreinte ${keyFingerprint(publicKeyOf(loadPrivateKey(pem)))}, inchangée).`);
    console.log('Refaites la copie hors du PC avec cette version chiffrée, et gardez la phrase de passe dans votre gestionnaire de mots de passe.');
  } else {
    if (out.startsWith(resolve('.'))) fail('La clé privée doit être en dehors du dépôt : choisissez un autre --out.');
    if (existsSync(out)) {
      const pem = readFileSync(out, 'utf8');
      fail(`Une clé existe déjà : ${out}\nElle n’est pas remplacée (les packs déjà signés ne seraient plus acceptés).`
        + (isEncryptedKey(pem) ? '' : '\nElle est en clair : npm run pack:keygen -- --chiffrer pour la protéger par une phrase de passe.')
        + '\nPour changer de clé (rotation) : npm run pack:keygen -- --out <autre fichier>.');
    }
    const passphrase = await askNewPassphrase();
    const { publicKey, privateKey } = generateKeys(passphrase);
    mkdirSync(dirname(out), { recursive: true });
    writeKey(out, privateKey);
    const fingerprint = keyFingerprint(publicKey);
    const keys = readKeys();
    keys.push({ publicKey, fingerprint, createdAt: today(), revoked: false });
    writeKeys(keys);
    console.log(`Clé privée (chiffrée) : ${out}   (à sauvegarder hors du PC ; ne jamais la donner ni la mettre sur le Drive)`);
    console.log(`Clé publique ajoutée à ${KEYS_FILE} (empreinte ${fingerprint}, ${keys.length} clé${keys.length > 1 ? 's' : ''} dans la liste) — à commiter avec l’appli.`);
  }
} catch (err) {
  fail(`Rien n’a été changé : ${err.message}.`);
}
