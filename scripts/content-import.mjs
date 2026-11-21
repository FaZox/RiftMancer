/**
 * npm run content:import [-- <dossier>] [--force]
 * Copies the card content (pictures, catalog with names and texts) from a
 * content folder into public/: by default ../sauvegarde-contenu (the backup
 * made before going public), or any folder laid out the same way
 * (public/cards/, public/card-hashes.json). Never committed to the public
 * repository (scripts/lib/content.mjs). Without --force, what is already here
 * is kept.
 */
import { cpSync, existsSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasCardContent } from './lib/content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const force = args.includes('--force');
const from = resolve(args.find(a => !a.startsWith('--')) || join(root, '..', 'sauvegarde-contenu'));

const src = (p) => [join(from, 'public', p), join(from, p)].find(existsSync);
const catalog = src('card-hashes.json');
const cards = src('cards');
if (!catalog || !cards || !statSync(cards).isDirectory()) {
  console.error(`Dossier de contenu incomplet : ${from}\nIl faut card-hashes.json et cards/ (ou public/card-hashes.json et public/cards/).`);
  process.exit(1);
}
if (hasCardContent(root) && !force) {
  console.log('Le contenu des cartes est déjà là (public/) : rien n’est copié. --force pour le remplacer.');
  process.exit(0);
}
mkdirSync(join(root, 'public'), { recursive: true });
copyFileSync(catalog, join(root, 'public', 'card-hashes.json'));
cpSync(cards, join(root, 'public', 'cards'), { recursive: true, force: true });
const n = readdirSync(join(root, 'public', 'cards')).filter(f => f.endsWith('.webp')).length;
console.log(`Contenu des cartes importé depuis ${from} : catalogue et ${n} images (+ miniatures).`);
