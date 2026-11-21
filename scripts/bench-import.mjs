/**
 * Imports a bench export of the app (Réglages → Développeur → Collecte banc
 * d'essai → Exporter) into model/real-photos-raw/, merging _collecte.json.
 *
 *   npm run bench:import -- <collecte.zip> [--dest model/real-photos-raw]
 *
 * Then: npm run eval:detector -- --scenes 0   (real photos only)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importBenchZip } from './lib/benchImport.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const destArg = argv.includes('--dest') ? argv[argv.indexOf('--dest') + 1] : 'model/real-photos-raw';
const zips = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dest');
if (!zips.length) {
  console.error('Usage : npm run bench:import -- <collecte.zip> [--dest model/real-photos-raw]');
  process.exit(1);
}
const dest = path.resolve(root, destArg);
for (const zip of zips) {
  try {
    const r = importBenchZip(new Uint8Array(fs.readFileSync(zip)), dest);
    console.log(`${path.basename(zip)} : ${r.photos} photo(s), ${r.lists} liste(s) de grille → ${dest}`);
    for (const m of r.moved) console.log(`  déplacée (corrigée dans l’appli) : ${m}`);
    console.log(`  _collecte.json : ${r.entries} photo(s) au total`);
  } catch (err) {
    console.error(`${path.basename(zip)} : ${err.message}`);
    process.exitCode = 1;
  }
}
