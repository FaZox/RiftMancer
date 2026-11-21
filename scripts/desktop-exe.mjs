/**
 * Windows installer of the PC app (after `npm run build` and the icons).
 *   npm run desktop:exe        → « RiftMancer »       (every day)
 *   npm run desktop:exe:test   → « RiftMancer Test »  (try new versions)
 * The test app installs next to the other one: own install folder, start
 * menu entry, data folder (%APPDATA%\riftmancer-test) and port (47322).
 */
import { build, Platform } from 'electron-builder';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const test = process.argv.includes('--test');
// Trial models (public/models/*-test.onnx, git-ignored): never in the everyday app.
if (!test && existsSync(join('dist', 'models'))) {
  for (const f of readdirSync(join('dist', 'models'))) if (f.endsWith('-test.onnx')) rmSync(join('dist', 'models', f), { force: true });
}
const config = test
  ? {
    appId: 'com.riftmancer.app.test',
    productName: 'RiftMancer Test',
    nsis: { shortcutName: 'RiftMancer Test' },
    extraMetadata: { variant: 'test' },
  }
  : { extraMetadata: { variant: 'daily' } };

await build({ targets: Platform.WINDOWS.createTarget('nsis'), config });
console.log(`\nInstalleur : release/${test ? 'RiftMancer Test' : 'RiftMancer'} Setup <version>.exe`);
