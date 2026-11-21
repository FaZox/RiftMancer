/**
 * Windows installer of the PC app (after `npm run build` and the icons).
 *   npm run desktop:exe        → « RiftMancer »       (every day)
 *   npm run desktop:exe:test   → « RiftMancer Test »  (try new versions)
 *   … --public                 → without the card content (GitHub release, npm run release)
 * The test app installs next to the other one: own install folder, start
 * menu entry, data folder (%APPDATA%\riftmancer-test) and port (47322).
 */
import { build, Platform } from 'electron-builder';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { stripCardContent } from './lib/content.mjs';

const test = process.argv.includes('--test');
// Trial models (public/models/*-test.onnx, git-ignored): never in the everyday app.
if (!test && existsSync(join('dist', 'models'))) {
  for (const f of readdirSync(join('dist', 'models'))) if (f.endsWith('-test.onnx')) rmSync(join('dist', 'models', f), { force: true });
}
if (process.argv.includes('--public')) console.log(`[desktop:exe] Version publique : ${stripCardContent('dist')} fichiers des cartes retirés de dist/`);
const config = test
  ? {
    appId: 'com.riftmancer.app.test',
    productName: 'RiftMancer Test',
    nsis: { shortcutName: 'RiftMancer Test' },
    extraMetadata: { variant: 'test' },
  }
  : { extraMetadata: { variant: 'daily' } };

// publish: 'never': started from « npm run release », electron-builder would try to upload to GitHub itself.
const make = () => build({ targets: Platform.WINDOWS.createTarget('nsis'), config, publish: 'never' });
try {
  await make();
} catch (err) {
  // electron-builder's icon tool sometimes crashes on exit (0xC0000005) after doing its job: once more
  console.warn(`[desktop:exe] Échec d’electron-builder (${String(err.message).split('\n')[0]}) : nouvel essai.`);
  await make();
}
console.log(`\nInstalleur : release/${test ? 'RiftMancer Test' : 'RiftMancer'} Setup <version>.exe`);
