/**
 * Screen tests (lot 11.3): npm run test:e2e
 * Runs tests/e2e/parcours.cjs in Electron on the built app (dist/, made by
 * `npm run build`; `--build` builds it first). The test photo — a catalogue
 * card laid slightly askew on a table — is made here, nothing is downloaded.
 * Screenshots of a failed journey: test-results/e2e/.
 */
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const CARD_ID = 'ogn-066-298';

if (process.argv.includes('--build')) {
  const r = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true });
  if (r.status) process.exit(r.status);
}
if (!existsSync(join(root, 'dist/index.html')) || !existsSync(join(root, 'dist/models'))) {
  console.error('Appli non construite : lancez « npm run build » (ou npm run test:e2e -- --build).');
  process.exit(1);
}

// The test photo: the card, 30 % of the width, turned by 4°, on a dark table
const card = JSON.parse(readFileSync(join(root, 'public/card-hashes.json'), 'utf8')).cards.find(c => c.id === CARD_ID);
const dir = join(tmpdir(), 'riftbound-e2e');
mkdirSync(dir, { recursive: true });
const image = join(dir, 'photo-test.jpg');
const art = await sharp(join(root, 'public/cards', `${CARD_ID}.webp`)).resize({ width: 380 })
  .rotate(4, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({ create: { width: 1280, height: 960, channels: 3, background: '#2b2620' } })
  .composite([{ input: art, gravity: 'center' }]).jpeg({ quality: 90 }).toFile(image);

const electron = createRequire(import.meta.url)('electron');
const env = { ...process.env, DIST: join(root, 'dist'), IMAGE: image, CARD: card.nameFr || card.name, OUT: join(root, 'test-results/e2e') };
delete env.ELECTRON_RUN_AS_NODE; // set by some tools: Electron would start as plain Node
const child = spawn(electron, [join(root, 'tests/e2e/parcours.cjs')], {
  cwd: root,
  stdio: 'inherit',
  env,
});
child.on('exit', (code) => process.exit(code ?? 1));
