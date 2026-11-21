// Copies the onnxruntime-web WASM runtime into public/ort/ so the YOLO
// detector works fully offline (no CDN). Runs automatically before dev/build.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const dest = join(root, 'public', 'ort');
// Plain WASM build (Android) + the build used by the WebGPU bundle (PC / browser).
const FILES = [
  'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm', 'ort-wasm-simd-threaded.asyncify.mjs',
];

mkdirSync(dest, { recursive: true });
for (const f of FILES) {
  const from = join(src, f);
  if (!existsSync(from)) {
    console.error(`[copy-ort] Missing ${from} - run npm install`);
    process.exit(1);
  }
  copyFileSync(from, join(dest, f));
}
console.log(`[copy-ort] ${FILES.length} files copied to public/ort/`);

// Third-party licences (AI models), shown in Réglages → À propos → « Licences »
// and shipped with the PC installer and the APK.
copyFileSync(join(root, 'THIRD_PARTY_LICENSES.md'), join(root, 'public', 'THIRD_PARTY_LICENSES.md'));
// The app's licence (MIT of the original project, LICENCE-ET-PUBLICATION.md): in every copy
copyFileSync(join(root, 'LICENSE'), join(root, 'public', 'LICENSE.txt'));
// Its notice: the app's copyright, the MIT notice of the original project (Nekoraru22), Riot Games
copyFileSync(join(root, 'NOTICE'), join(root, 'public', 'NOTICE.txt'));
