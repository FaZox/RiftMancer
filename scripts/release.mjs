/**
 * npm run release -- <version>      (lot 2.2 of AMELIORATIONS-APPLI.md)
 *
 * Builds the package given to friends, in release/v<version>/:
 *   RiftMancer-Setup-<version>.exe          PC installer (everyday app)
 *   RiftMancer-<version>.apk                Android app, signed with the distribution key
 *   NOUVEAUTES.txt / WHATS-NEW.txt          section « ## <version> » of docs/NOUVEAUTES.md / docs/WHATS-NEW.md
 *   LISEZ-MOI-AMIS.txt / FRIENDS-GUIDE.txt  docs/LISEZ-MOI-AMIS.md / docs/FRIENDS-GUIDE.md (lot 11.1)
 *   LICENSE.txt                             LICENSE (GNU AGPL-3.0)
 *   NOTICE.txt                              NOTICE (MIT notice of the original project: in every copy)
 *   THIRD_PARTY_LICENSES.txt                THIRD_PARTY_LICENSES.md
 *   EMPREINTES.txt                          SHA-256 of every file
 * and the public package, for the GitHub release, in release/v<version>-public/:
 * the same files, but the app and the APK hold NO card content (pictures,
 * catalog: Riot Games); they start with catalog-base.json and get the cards
 * on first launch. Checked from the inside (APK, PC app).
 * Steps: clean Git tree, version higher than every one distributed (tags v*),
 * notes written, signing key present → package.json version → tests, lint,
 * installer, APK → release:check → commit « Version <version> » + tag v<version>
 * (local: push them yourself). Test versions never go into a package.
 * On failure, package.json is put back as it was.
 *
 * npm run release -- <version> --essai   builds the same package in
 * release/essai-v<version>/ to try the whole chain: no commit, no tag, the
 * version of package.json is put back afterwards. Never give that folder away.
 */
import { execSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkReleaseDir, checksumsText, releaseNotes, sha256, versionProblem, versionsIn, ORIGIN_COPYRIGHT, APP_LICENCE_TITLE } from './lib/release.mjs';
import { hasCardContent } from './lib/content.mjs';

const args = process.argv.slice(2);
const version = (args.find(a => !a.startsWith('--')) || '').trim();
const trial = args.includes('--essai');
const fail = (msg) => { console.error(`\n[release] ${msg}`); process.exit(1); };
const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();
const run = (cmd) => {
  console.log(`\n[release] ${cmd}`);
  const r = spawnSync(cmd, { stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error(`« ${cmd} » a échoué`);
};

if (!version) fail('Version manquante : npm run release -- 2.2.0');

// 1. Clean tree: nothing modified; nothing new where the build reads from.
const status = git('status --porcelain').split('\n').filter(Boolean);
const modified = status.filter(l => !l.startsWith('??'));
const FEEDS = /^"?(public|src|electron|scripts|build|android\/app\/src|index\.html|vite\.config\.js|package(-lock)?\.json|capacitor\.config\.json)(\/|"?$)/;
const newInBuild = status.filter(l => l.startsWith('??') && FEEDS.test(l.slice(3)));
if ((modified.length || newInBuild.length) && trial) {
  console.warn(`[release] Essai avec un arbre Git pas propre (${modified.length + newInBuild.length} fichier(s)) : refusé pour une vraie version.`);
} else if (modified.length || newInBuild.length) {
  fail(`Arbre Git pas propre : commite ou range d’abord ces fichiers.\n  ${[...modified, ...newInBuild].join('\n  ')}`);
}

// 2. Version: higher than every distributed one, not lower than package.json.
const pkgText = readFileSync('package.json', 'utf8');
const lockText = readFileSync('package-lock.json', 'utf8');
const current = JSON.parse(pkgText).version;
const released = versionsIn(git('tag --list v*').split('\n').filter(Boolean));
const problem = versionProblem(version, current, released);
if (problem) fail(problem);

// 3. What the package needs.
const notes = existsSync('docs/NOUVEAUTES.md') && releaseNotes(readFileSync('docs/NOUVEAUTES.md', 'utf8'), version);
if (!notes) fail(`Écris d’abord les nouveautés de la version dans docs/NOUVEAUTES.md (titre « ## ${version} »), puis commite.`);
const notesEn = existsSync('docs/WHATS-NEW.md') && releaseNotes(readFileSync('docs/WHATS-NEW.md', 'utf8'), version);
if (!notesEn) fail(`Écris aussi les nouveautés en anglais dans docs/WHATS-NEW.md (titre « ## ${version} »), puis commite.`);
if (!existsSync('docs/LISEZ-MOI-AMIS.md')) fail('Guide docs/LISEZ-MOI-AMIS.md introuvable.');
// The card content is not in the public repository (scripts/lib/content.mjs): a version for friends needs it
if (!hasCardContent(process.cwd())) fail('Contenu des cartes absent (public/card-hashes.json, public/cards/) : npm run content:import -- <dossier>, ou npm run catalog:update.');
if (!existsSync('docs/FRIENDS-GUIDE.md')) fail('Guide docs/FRIENDS-GUIDE.md introuvable.');
if (!existsSync('LICENSE') || !readFileSync('LICENSE', 'utf8').includes(APP_LICENCE_TITLE)) fail('Fichier LICENSE absent ou sans le texte de la licence AGPL-3.0.');
if (!existsSync('NOTICE') || !readFileSync('NOTICE', 'utf8').includes(ORIGIN_COPYRIGHT)) fail(`Fichier NOTICE absent ou sans la ligne « ${ORIGIN_COPYRIGHT} » du projet d’origine (LICENCE-ET-PUBLICATION.md).`);
if (!existsSync(resolve('android', 'keystore.properties')) && !process.env.RB_KEYSTORE) {
  fail('Pas de clé de signature (android/keystore.properties) : voir l’annexe A d’AMELIORATIONS-APPLI.md.');
}

// 4. Version everywhere (package.json is the only source: about, APK, installer).
const setVersion = (text, v) => text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${v}$2`);
const restore = () => { writeFileSync('package.json', pkgText); writeFileSync('package-lock.json', lockText); };
if (current !== version) {
  writeFileSync('package.json', setVersion(pkgText, version));
  const lock = JSON.parse(lockText);
  lock.version = version;
  if (lock.packages?.['']) lock.packages[''].version = version;
  writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
}

const out = resolve('release', `${trial ? 'essai-' : ''}v${version}`);
const outPublic = `${out}-public`;

/** 5–6. A package folder (rebuilt from scratch: it only holds this script's output), then checked. */
function assemble(out, publicPackage) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const crlf = (s) => s.replace(/\r?\n/g, '\r\n');
  copyFileSync(resolve('release', `RiftMancer Setup ${version}.exe`), join(out, `RiftMancer-Setup-${version}.exe`));
  copyFileSync(resolve('release', 'RiftMancer.apk'), join(out, `RiftMancer-${version}.apk`));
  writeFileSync(join(out, 'NOUVEAUTES.txt'), crlf(notes));
  writeFileSync(join(out, 'WHATS-NEW.txt'), crlf(notesEn));
  writeFileSync(join(out, 'LISEZ-MOI-AMIS.txt'), crlf(readFileSync('docs/LISEZ-MOI-AMIS.md', 'utf8')));
  writeFileSync(join(out, 'FRIENDS-GUIDE.txt'), crlf(readFileSync('docs/FRIENDS-GUIDE.md', 'utf8')));
  writeFileSync(join(out, 'LICENSE.txt'), crlf(readFileSync('LICENSE', 'utf8')));
  writeFileSync(join(out, 'NOTICE.txt'), crlf(readFileSync('NOTICE', 'utf8')));
  writeFileSync(join(out, 'THIRD_PARTY_LICENSES.txt'), crlf(readFileSync('THIRD_PARTY_LICENSES.md', 'utf8')));
  const files = readdirSync(out).sort().map(name => ({ name, sha256: sha256(readFileSync(join(out, name))) }));
  writeFileSync(join(out, 'EMPREINTES.txt'), checksumsText(files));

  // 6. Nothing forbidden inside.
  const { problems, notes: remarks } = checkReleaseDir(out, { version, winUnpacked: resolve('release', 'win-unpacked'), publicPackage });
  for (const n of remarks) console.log(`  · ${n}`);
  if (problems.length) throw new Error(`paquet${publicPackage ? ' public' : ''} refusé :\n  ${problems.join('\n  ')}`);
}

try {
  run('npm test');
  run('npm run lint');
  // The friends' package (with the cards)
  run('npm run desktop:exe');
  run('npm run build:mobile');
  run('node scripts/android-apk.mjs --release');
  assemble(out, false);
  // The public package (GitHub release): the same app without the card content
  run('npm run build');
  run('node scripts/make-icons.mjs');
  run('node scripts/desktop-exe.mjs --public');
  run('node scripts/copy-ort.mjs');
  run('node scripts/build-mobile.mjs --public');
  run('node scripts/android-apk.mjs --release');
  assemble(outPublic, true);
  run('npm run build'); // dist/ with the cards again (PC app started from the project)
} catch (e) {
  restore();
  fail(`${e.message}\nVersion du projet remise à ${current}.`);
}

if (trial) {
  restore();
  console.log(`
Essai réussi : release/essai-v${version}/ et release/essai-v${version}-public/ (rien d’enregistré, version du projet inchangée, à ne pas distribuer).`);
  for (const f of readdirSync(out).sort()) console.log(`  ${f}`);
  process.exit(0);
}

// 7. Record the version (local commit and tag).
if (current !== version) git(`commit -m "Version ${version}" -- package.json package-lock.json`);
git(`tag v${version}`);
console.log(`\nPaquet des amis (avec les cartes) : release/v${version}/`);
for (const f of readdirSync(out).sort()) console.log(`  ${f}`);
console.log(`\nPaquet public (sans les cartes) : release/v${version}-public/`);
for (const f of readdirSync(outPublic).sort()) console.log(`  ${f}`);
console.log('\nÀ faire :');
console.log('  - copier release/v' + version + '/ dans le Drive partagé (jamais sur GitHub : il contient les cartes) ;');
console.log(`  - dépôt public : npm run public:export, commit, tag v${version}, puis une Release GitHub avec les fichiers de release/v${version}-public/.`);
