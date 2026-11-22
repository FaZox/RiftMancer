/**
 * npm test: the Node tests, in French whatever the machine (tests/lang-fr.mjs).
 * Without the card content (public/card-hashes.json and the card pictures —
 * a public copy of the repository, or a Git LFS checkout without the files),
 * the test files that need it are set aside and named: get the content with
 * `npm run content:import -- <folder>` or `npm run catalog:update`.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { hasCardContent, needsCardContent } from './lib/content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
export const TEST_FILES = [
  'decks.test.mjs', 'collection.test.mjs', 'sync.test.cjs', 'syncmodes.test.cjs', 'security.test.cjs', 'sanitize.test.mjs',
  'syncproto.test.cjs', 'matcher.test.mjs', 'play.test.mjs', 'detector.test.mjs', 'mdns.test.cjs', 'engines.test.mjs',
  'cornerCache.test.mjs', 'alignedVerify.test.mjs', 'printingPick.test.mjs', 'printingChoice.test.mjs', 'catalogBase.test.mjs', 'rifthunt.test.mjs', 'cardmarketLinks.test.mjs', 'rulings.test.mjs', 'manualCards.test.mjs', 'catalogChoice.test.mjs', 'bench.test.mjs', 'cropSame.test.mjs',
  'banlist.test.mjs', 'prices.test.mjs', 'conditions.test.mjs', 'scanRules.test.mjs', 'release.test.mjs', 'backups.test.mjs',
  'conflicts.test.cjs', 'content.test.cjs', 'banUpdate.test.mjs', 'frTranslations.test.mjs', 'galleryCards.test.mjs',
  'pack.test.cjs', 'dataFolder.test.cjs', 'versionCompat.test.mjs', 'diagnostic.test.mjs', 'splash.test.mjs',
  'navigation.test.mjs', 'settingsSections.test.mjs', 'globalSearch.test.mjs', 'welcome.test.mjs', 'polish.test.mjs',
  'deckVersions.test.mjs', 'opponentNotes.test.mjs', 'scoreGame.test.mjs', 'errata.test.mjs', 'deckCodes.test.mjs',
  'handsFree.test.mjs', 'gridScan.test.mjs', 'binder.test.mjs', 'i18n.test.mjs', 'scanSounds.test.mjs', 'variants.test.mjs',
  'priceMoves.test.mjs', 'friendLists.test.mjs', 'electronCheck.test.mjs', 'contentFetch.test.mjs', 'publicExport.test.mjs', 'cardQuery.test.mjs', 'cardsBrowser.test.mjs',
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let files = TEST_FILES.map(f => join('tests', f));
  if (!hasCardContent(root)) {
    const skipped = files.filter(f => needsCardContent(readFileSync(join(root, f), 'utf8')));
    files = files.filter(f => !skipped.includes(f));
    console.log(`Contenu des cartes absent : ${skipped.length} fichiers de tests mis de côté (${skipped.map(f => f.slice(6)).join(', ')}).`);
    console.log('Pour les lancer : npm run content:import -- <dossier>, ou npm run catalog:update.\n');
  }
  const r = spawnSync(process.execPath, ['--import', './tests/lang-fr.mjs', '--test', ...files, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
