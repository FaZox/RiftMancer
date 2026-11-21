/**
 * npm run check:electron — run by the CI and by `npm run release:check`.
 * Fails when the Electron shipped in the PC app is no longer maintained, or
 * more than 30 days behind the latest patch of its major version
 * (scripts/lib/electronCheck.mjs). Offline: a warning only.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { electronStatus } from './lib/electronCheck.mjs';

export function checkElectron({ log = console.log } = {}) {
  let installed;
  try { installed = JSON.parse(readFileSync('node_modules/electron/package.json', 'utf8')).version; }
  catch { installed = JSON.parse(readFileSync('package.json', 'utf8')).devDependencies.electron.replace(/^[~^]/, ''); }
  let time;
  try {
    const out = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['view', 'electron', 'time', '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000, shell: process.platform === 'win32' });
    time = JSON.parse(out);
  } catch {
    log(`⚠ Electron ${installed} : registre npm injoignable, version non vérifiée (hors ligne ?).`);
    return true;
  }
  const s = electronStatus({ installed, time });
  if (s.ok) {
    log(`Electron ${installed} : à jour${s.latest !== installed ? ` (${s.latest} sortie il y a ${s.behindDays} jour${s.behindDays > 1 ? 's' : ''}, pensez à la prendre)` : ''}.`);
    return true;
  }
  for (const p of s.problems) log(`✗ ${p}`);
  return false;
}

// Run directly (not when imported by release-check.mjs)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/check-electron.mjs')) {
  process.exit(checkElectron() ? 0 : 1);
}
