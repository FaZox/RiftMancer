/**
 * New expansion? One command updates the whole card catalog:
 *
 *   npm run catalog:update
 *
 *   1. model/cards_scraper.py   cards, images, recognition features, French data
 *                               (Python + model/requirements.txt)
 *   2. scripts/enrich-catalog   full English names, French names for every print
 *      model/manual_cards.py    manual additions (model/manual-cards/: cards the
 *                               official gallery does not publish; removed as soon as it does)
 *   3. scripts/make-thumbs      grid thumbnails
 *   4. scripts/build-embeddings AI signatures of the cards (scanner, step 4 of
 *                               AMELIORATIONS-MODELES.md)
 *   5. scripts/catalog-groups   reprints with the same artwork (scanner asks the
 *                               set) — uses the AI signatures of step 4
 *
 * Before step 1, download the two French files from a browser into model/fr/
 * (the site blocks scripts): https://riftboundfr.fr/repertoire-cartes.json and
 * https://riftboundfr.fr/textes-cartes.json
 *
 * Then rebuild (npm run build / npm run android:apk). The PC app sends the new
 * catalog and images to the phone at the next sync; prices pick up the new
 * cards at their next daily update.
 *
 *   npm run catalog:update -- --skip-scraper   (only steps 2 to 5)
 */
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';

const skipScraper = process.argv.includes('--skip-scraper');

function run(label, cmd, args) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n✗ ${label} a échoué (code ${r.status}).`);
    process.exit(r.status || 1);
  }
}

for (const f of ['model/fr/repertoire-cartes.json', 'model/fr/textes-cartes.json']) {
  try {
    const age = (Date.now() - statSync(f).mtimeMs) / 86400000;
    if (age > 14) console.warn(`⚠ ${f} date de ${Math.round(age)} jours : retéléchargez-le pour avoir les noms français des nouvelles cartes.`);
  } catch {
    console.warn(`⚠ ${f} manquant : les nouvelles cartes n’auront pas de nom français.`);
  }
}

if (!skipScraper) {
  const py = spawnSync('python', ['-c', 'import PIL, cv2, numpy, requests, tqdm'], { shell: process.platform === 'win32' });
  if (py.status !== 0) {
    console.error('✗ Python ou ses modules manquent. Installez-les une fois :\n    pip install -r model/requirements.txt');
    process.exit(1);
  }
  run('1/5 Cartes, images et reconnaissance', 'python', ['model/cards_scraper.py']);
}
run('2/5 Noms complets et français', 'node', ['scripts/enrich-catalog.mjs']);
run('2/5 Ajouts manuels (cartes absentes de la galerie officielle)', 'python', ['model/manual_cards.py']);
run('3/5 Miniatures', 'node', ['scripts/make-thumbs.mjs']);
run('4/5 Signatures IA des cartes', 'node', ['scripts/build-embeddings.mjs']);
run('5/5 Illustrations identiques (rééditions)', 'node', ['scripts/catalog-groups.mjs']);

console.log('\n  Cartes bannies : vérifiez public/banlist.json avec les annonces officielles de Riot.');
console.log('\n✓ Catalogue à jour. Ensuite : npm run build (PC) et npm run android:apk (téléphone).');
console.log('  Si la nouvelle extension n’apparaît pas à sa place dans les listes, ajoutez son code à SET_ORDER dans src/lib/catalog.js.');
