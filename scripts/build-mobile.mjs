// Builds the web app for the Android app (dist-mobile/) and syncs it into the
// Android project. The APK ships the thumbnails, the full-size card images
// (zoom) and the two models of public/models/ (detector, card recognition —
// model/MODELS.md). Left out to keep the APK small:
//   - ONNX Runtime's WebGPU build (the phone uses the plain WASM one);
//   - the service worker.
import { execSync } from 'node:child_process';
import { readdirSync, rmSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import csp from '../electron/csp.cjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripCardContent } from './lib/content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-mobile');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

// The card images are not in git (public/cards/): building from a copy without
// them (e.g. a .claude/worktrees/ folder) would give an app with no pictures.
// --public (GitHub release, npm run release): built without the card content.
const publicBuild = process.argv.includes('--public');
const cardsDir = join(root, 'public', 'cards');
const count = existsSync(cardsDir) ? readdirSync(cardsDir).filter(f => f.endsWith('.webp')).length : 0;
if (!publicBuild && (count < 100 || !existsSync(join(cardsDir, 'thumbs')))) {
  console.error(`[build-mobile] Images des cartes introuvables dans ${cardsDir}.`);
  console.error('Lancez la commande depuis le dossier principal du projet (pas depuis .claude/worktrees/...).');
  process.exit(1);
}

run('npx vite build --outDir dist-mobile --emptyOutDir');
if (publicBuild) console.log(`[build-mobile] Version publique : ${stripCardContent(out)} fichiers des cartes retirés`);

// Trial models (public/models/*-test.onnx, git-ignored): only in a test build
// (npm run android:apk:test passes --test); never shipped in the everyday app.
if (!process.argv.includes('--test')) {
  for (const f of readdirSync(join(out, 'models'))) if (f.endsWith('-test.onnx')) rmSync(join(out, 'models', f), { force: true });
}

// Lot 4.6 (decided): no full-size card images in the APK (about 131 MB): every
// friend has the PC app, the phone receives them at its first sync (existing
// mechanism). The thumbnails stay (lists, and the zoom until then).
if (!process.argv.includes('--full-images') && existsSync(join(out, 'cards'))) {
  let removed = 0, bytes = 0;
  for (const f of readdirSync(join(out, 'cards'))) {
    if (!f.endsWith('.webp')) continue;
    bytes += statSync(join(out, 'cards', f)).size;
    rmSync(join(out, 'cards', f), { force: true });
    removed++;
  }
  console.log(`[build-mobile] ${removed} grandes images retirées de l'APK (${Math.round(bytes / 1024 / 1024)} Mo)`);
}

// No service worker in the native app.
for (const f of readdirSync(out)) {
  if (f === 'sw.js' || f.startsWith('workbox-')) rmSync(join(out, f), { force: true });
}

// WebGPU build of ONNX Runtime: not used on Android.
for (const f of readdirSync(join(out, 'ort'))) {
  if (f.includes('.asyncify.')) rmSync(join(out, 'ort', f), { force: true });
}

// Content-Security-Policy of the Android app (see electron/csp.cjs).
const indexFile = join(out, 'index.html');
const html = readFileSync(indexFile, 'utf8');
if (!html.includes('Content-Security-Policy')) {
  writeFileSync(indexFile, html.replace('<meta charset="UTF-8" />',
    `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp.MOBILE_CSP}" />`));
}

run('npx cap sync android');
