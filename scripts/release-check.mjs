/**
 * npm run release:check [-- <dossier>]
 * Checks distribution packages (lot 2.2): by default every folder release/v*.
 * Fails when a package holds the signing key, a database, bench photos or
 * data, training files, a .env, a test version, or a file that does not match
 * EMPREINTES.txt. Looks inside the APK and inside the PC app (release/win-unpacked).
 * First: the Electron of the PC app still maintained and up to date (check-electron.mjs).
 */
import { existsSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { checkReleaseDir } from './lib/release.mjs';
import { checkElectron } from './check-electron.mjs';

const arg = process.argv[2];
const dirs = arg ? [resolve(arg)]
  : existsSync('release') ? readdirSync('release').filter(d => /^v\d+\.\d+\.\d+$/.test(d)).map(d => resolve('release', d)) : [];
if (!dirs.length) {
  console.error('Aucun paquet à vérifier (dossier release/v<version>/ introuvable).');
  process.exit(1);
}
let failed = !checkElectron();
for (const dir of dirs) {
  const version = /^v(\d+\.\d+\.\d+)$/.exec(basename(dir))?.[1];
  const { problems, notes } = checkReleaseDir(dir, { version, winUnpacked: resolve('release', 'win-unpacked') });
  console.log(`\n${join('release', basename(dir))} : ${problems.length ? `${problems.length} problème(s)` : 'rien d’interdit'}`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  for (const n of notes) console.log(`  · ${n}`);
  if (problems.length) failed = true;
}
if (failed) console.error('\nNe distribue pas ce paquet.');
process.exit(failed ? 1 : 0);
