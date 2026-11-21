// Generates small WebP previews of the card images for collection lists:
//   public/cards/<id>.webp  ->  public/cards/thumbs/<id>.webp  (300 px wide)
// The original images are only read, never modified: the zoom view keeps
// using them at full quality. Only missing or outdated thumbnails are rebuilt.
// Usage: npm run thumbs  (add -- --force to rebuild all)
import { readdirSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const WIDTH = 300;
const QUALITY = 85;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cardsDir = join(root, 'public', 'cards');
const thumbsDir = join(cardsDir, 'thumbs');
const force = process.argv.includes('--force');

if (!existsSync(cardsDir)) {
  console.log('[thumbs] public/cards not found - run the scraper first. Skipping.');
  process.exit(0);
}
mkdirSync(thumbsDir, { recursive: true });

const names = readdirSync(cardsDir).filter(n => n.endsWith('.webp'));
let made = 0;
for (const name of names) {
  const src = join(cardsDir, name);
  const dst = join(thumbsDir, name);
  if (!force && existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) continue;
  await sharp(src)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(dst);
  made++;
}
console.log(`[thumbs] ${made} generated, ${names.length - made} up to date`);
