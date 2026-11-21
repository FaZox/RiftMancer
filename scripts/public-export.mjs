/**
 * npm run public:export [-- <dossier>]
 * The public copy of the repository: every file tracked by Git (never the
 * working files that are not), real files for Git LFS, WITHOUT the card
 * content of Riot Games / riftboundfr.fr nor the images of unknown licence
 * (scripts/lib/content.mjs, PUBLIC_EXCLUDED). Default folder:
 * ../riftmancer-public (outside this repository). Nothing is sent anywhere:
 * the folder becomes the new public repository only once checked and
 * approved. The report lists what is kept out, the size, and the files that
 * still hold personal traces (paths of this PC, e-mail address) to clean.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { excludedReason } from './lib/content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Tracked files split into published / kept out (with the reason). */
export function splitFiles(tracked) {
  const published = [], excluded = [];
  for (const f of tracked) {
    const why = excludedReason(f);
    if (why) excluded.push([f, why]); else published.push(f);
  }
  return { published, excluded };
}

/** Personal traces to clean before publishing: paths of this PC, e-mail addresses. */
export function personalTraces(text) {
  const out = [];
  // a real user name — not a placeholder (<name>, …), a regex ([^…]) or an invented example
  const names = [...text.matchAll(/[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}([^\\/\s"'`]+)/gi)].map(m => m[1]);
  if (names.some(n => !/^(<name>|<nom>|…|someone|Camille|\[|\(|\$)/i.test(n))) out.push('chemin d’un PC (C:\\Users\\…)');
  if (/[A-Za-z0-9._%+-]+@(gmail|hotmail|outlook|yahoo|free|orange|laposte|icloud)\.[a-z]+/i.test(text)) out.push('adresse e-mail');
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dest = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || join(root, '..', 'riftmancer-public'));
  if (dest.startsWith(resolve(root))) { console.error('Le dossier public doit être hors de ce dépôt.'); process.exit(1); }
  if (existsSync(dest) && readdirSync(dest).length) { console.error(`${dest} n’est pas vide : choisissez un autre dossier ou videz-le.`); process.exit(1); }
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const { published, excluded } = splitFiles(tracked);
  let bytes = 0;
  const traces = [];
  for (const f of published) {
    const from = join(root, f);
    if (!existsSync(from)) continue; // deleted in the working tree
    const to = join(dest, f);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    const size = statSync(from).size;
    bytes += size;
    if (size < 2e8) {
      const found = personalTraces(readFileSync(from).toString('utf8'));
      if (found.length) traces.push(`${f} : ${found.join(', ')}`);
    }
  }
  const byReason = new Map();
  for (const [, why] of excluded) byReason.set(why, (byReason.get(why) || 0) + 1);
  const report = [
    `Copie publique : ${dest}`,
    `${published.length} fichiers publiés, ${(bytes / 1e6).toFixed(1)} Mo`,
    `Gardés hors du dépôt public (${excluded.length}) :`,
    ...[...byReason].map(([why, n]) => `  - ${n} × ${why}`),
    `Traces personnelles à nettoyer (${traces.length}) :`,
    ...traces.map(t => `  - ${t}`),
  ].join('\n');
  writeFileSync(join(dest, '..', `${dest.split(/[\\/]/).pop()}-rapport.txt`), `${report}\n`);
  console.log(report);
}
