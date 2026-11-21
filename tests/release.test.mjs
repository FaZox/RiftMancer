// Lot 2 (AMELIORATIONS-APPLI.md): signing and distribution package.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './helpers.mjs';

const R = await import('../scripts/lib/release.mjs');
const { APP_VERSION, buildDateLabel } = await import('../src/lib/appVersion.js');
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('one version: package.json, shown in À propos with the build date', () => {
  assert.equal(APP_VERSION, pkg.version);
  assert.match(read('vite.config.js'), /__APP_VERSION__: JSON\.stringify\(version\)/);
  assert.match(read('android/app/build.gradle'), /pkg\.version/, 'APK versionName / versionCode from package.json');
  assert.equal(JSON.parse(read('package-lock.json')).version, pkg.version);
  assert.equal(buildDateLabel(Date.UTC(2026, 10, 17, 12)), 'construite le 17 novembre 2026');
  assert.equal(buildDateLabel(null), '');
  assert.equal(R.versionCode('2.1.0'), 20100);
  assert.ok(R.versionCode('2.1.0') > R.versionCode('1.0.0'), 'the phone accepts 2.1.0 over the 1.0.0 already installed');
});

test('every distribution goes up', () => {
  assert.deepEqual(R.parseVersion('2.10.3'), [2, 10, 3]);
  assert.equal(R.parseVersion('2.1'), null);
  assert.equal(R.parseVersion('v2.1.0'), null);
  assert.ok(R.compareVersions('2.10.0', '2.9.9') > 0);
  assert.equal(R.versionProblem('2.1.0', '2.1.0', []), null, 'first distribution of the current version');
  assert.equal(R.versionProblem('2.2.0', '2.1.0', ['2.1.0']), null);
  assert.match(R.versionProblem('2.1.0', '2.1.0', ['2.1.0']), /déjà été distribuée/);
  assert.match(R.versionProblem('2.0.5', '2.1.0', ['2.0.4']), /plus ancienne que celle du projet/);
  assert.match(R.versionProblem('2.1.1', '2.1.0', ['2.2.0']), /plus ancienne que la dernière distribuée/);
  assert.match(R.versionProblem('deux', '2.1.0'), /n’est pas une version/);
  assert.deepEqual(R.versionsIn(['v2.1.0', 'v2.2.0', 'banc-15-11', 'v3']), ['2.1.0', '2.2.0']);
});

test('NOUVEAUTES.txt comes from docs/NOUVEAUTES.md; the current version has its notes', () => {
  const md = '# N\n\n## 2.2.0 — 1er décembre 2026\n\n- Nouveau\n\n## 2.1.0\n\n- Avant\n';
  assert.equal(R.releaseNotes(md, '2.2.0'), 'RiftMancer 2.2.0 — 1er décembre 2026\n\n- Nouveau\n');
  assert.equal(R.releaseNotes(md, '2.1.0'), 'RiftMancer 2.1.0\n\n- Avant\n');
  assert.equal(R.releaseNotes(md, '2.1'), null);
  assert.equal(R.releaseNotes('## 3.0.0\n\n## 2.0.0\n- x', '3.0.0'), null, 'empty section');
  assert.ok(R.releaseNotes(read('docs/NOUVEAUTES.md'), pkg.version), `notes of ${pkg.version} written`);
  assert.ok(existsSync(new URL('docs/LISEZ-MOI-AMIS.md', root)), 'guide for friends (lot 11.1)');
});

test('EMPREINTES.txt: sha256sum format, how to check on Windows', () => {
  const t = R.checksumsText([{ name: 'a.apk', sha256: R.sha256(Buffer.from('a')) }]);
  assert.match(t, /Get-FileHash/);
  assert.ok(t.includes('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb  a.apk'));
});

test('never in a package: key, databases, bench data, training files, .env, trial models', () => {
  for (const p of ['android/riftbound-release.jks', 'x/keystore.properties', 'collection.sqlite', 'backups/collection-2026.sqlite',
    'collection.sqlite-wal', 'model/real-photos-1115/a.jpg', 'sauvegarde-modeles/x.onnx', 'model/runs/pose/w.onnx',
    'yolo11s-pose.pt', '.env', 'assets/.env.local', 'bench/_collecte.json', 'banc-collecte-20261115_120000.zip',
    'assets/public/models/yolo11s-pose-riftbound-dyn-test.onnx', 'D:\\SAUVEGARDE-MODELES\\a']) {
    assert.ok(R.forbiddenReason(p), p);
  }
  for (const p of ['assets/public/models/yolo11s-pose-riftbound-dyn.onnx', 'dist/cards/OGN-001.webp', 'dist/card-hashes.json',
    'electron/store.cjs', 'resources/app.asar', 'classes.dex', 'dist/assets/index-abc.js', 'environment.js']) {
    assert.equal(R.forbiddenReason(p), null, p);
  }
});

// Minimal zip writer (stored and deflated entries) for the tests.
function makeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content, deflate] of entries) {
    const raw = Buffer.from(content), data = deflate ? deflateRawSync(raw) : raw, n = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data); centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// Minimal asar writer: same layout as @electron/asar.
function makeAsar(files) {
  const tree = { files: {} };
  const datas = [];
  let offset = 0;
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/'); let node = tree;
    for (const d of parts.slice(0, -1)) node = node.files[d] ??= { files: {} };
    const data = Buffer.from(content);
    node.files[parts.at(-1)] = { size: data.length, offset: String(offset) };
    datas.push(data); offset += data.length;
  }
  const json = Buffer.from(JSON.stringify(tree));
  const padded = Math.ceil(json.length / 4) * 4;
  const header = Buffer.alloc(8 + padded); header.writeUInt32LE(4 + padded, 0); header.writeUInt32LE(json.length, 4); json.copy(header, 8);
  const size = Buffer.alloc(8); size.writeUInt32LE(4, 0); size.writeUInt32LE(header.length, 4);
  return Buffer.concat([size, header, ...datas]);
}

test('reads inside an APK (zip) and the PC app (asar) without extracting them', () => {
  const zip = makeZip([['AndroidManifest.xml', 'm', false], ['assets/public/index.html', '<html>bonjour</html>', true]]);
  const entries = R.zipEntries(zip);
  assert.deepEqual(entries.map(e => e.name), ['AndroidManifest.xml', 'assets/public/index.html']);
  assert.equal(R.zipRead(zip, entries[1]).toString(), '<html>bonjour</html>');
  const asar = R.asarFiles(makeAsar({ 'package.json': '{"version":"2.1.0","variant":"daily"}', 'dist/index.html': 'x' }));
  assert.deepEqual(asar.files, ['package.json', 'dist/index.html']);
  assert.deepEqual(R.checkPcApp(asar, '2.1.0'), []);
  assert.deepEqual(R.checkPcApp(R.asarFiles(makeAsar({ 'package.json': '{"version":"2.1.0","variant":"test"}' })), '2.1.0'),
    ['appli PC « test » au lieu de l’appli de tous les jours']);
  // The real PC app built by electron-builder, when there is one on this PC.
  const real = new URL('release/win-unpacked/resources/app.asar', root);
  if (existsSync(real)) {
    const a = R.asarFiles(readFileSync(real));
    assert.ok(a.files.includes('package.json') && a.files.includes('dist/index.html'));
    assert.match(JSON.parse(a.read('package.json')).name, /^(riftmancer|riftbound-scanner)$/, 'RiftMancer (or a PC app built before the new name)');
  }
});

test('release:check refuses a package with something forbidden, a test version or a wrong checksum', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rb-release-'));
  const pc = mkdtempSync(join(tmpdir(), 'rb-win-'));
  try {
    const put = (name, content) => writeFileSync(join(dir, name), content);
    const sums = () => put('EMPREINTES.txt', R.checksumsText(['Riftbound-Scanner-2.1.0.apk', 'Riftbound-Scanner-Setup-2.1.0.exe', 'NOUVEAUTES.txt', 'LICENSE.txt', 'THIRD_PARTY_LICENSES.txt']
      .filter(f => existsSync(join(dir, f))).map(name => ({ name, sha256: R.sha256(readFileSync(join(dir, name))) }))));
    put('Riftbound-Scanner-2.1.0.apk', makeZip([['assets/public/models/yolo11s-pose-riftbound-dyn.onnx', 'm', false], ['assets/public/LICENSE.txt', 'l', false]]));
    put('Riftbound-Scanner-Setup-2.1.0.exe', 'MZ');
    put('NOUVEAUTES.txt', 'n');
    put('LICENSE.txt', `${R.APP_LICENCE_TITLE}\r\n\r\n${R.ORIGIN_COPYRIGHT}\r\n`);
    put('THIRD_PARTY_LICENSES.txt', 't');
    sums();
    rmSync(pc, { recursive: true }); // no win-unpacked: said, not a failure
    let r = R.checkReleaseDir(dir, { version: '2.1.0', winUnpacked: pc });
    assert.deepEqual(r.problems, []);
    assert.match(r.notes[0], /non vérifiée/);

    // PC app of the same build: inspected
    const res = join(pc, 'resources');
    mkdirSync(res, { recursive: true });
    writeFileSync(join(res, 'LICENSE.txt'), 'l');
    writeFileSync(join(res, 'app.asar'), makeAsar({ 'package.json': '{"version":"2.1.0","variant":"daily"}', 'dist/LICENSE.txt': 'l', 'dist/collection.sqlite': 'x' }));
    r = R.checkReleaseDir(dir, { version: '2.1.0', winUnpacked: pc });
    assert.deepEqual(r.problems, ['appli PC → dist/collection.sqlite : base de données']);

    writeFileSync(join(res, 'app.asar'), makeAsar({ 'package.json': '{"version":"2.1.0","variant":"daily"}', 'dist/LICENSE.txt': 'l' }));
    put('Riftbound-Scanner-2.1.0.apk', makeZip([['assets/public/models/yolo11s-pose-riftbound-dyn-test.onnx', 'm', false], ['assets/public/LICENSE.txt', 'l', false]]));
    sums();
    r = R.checkReleaseDir(dir, { version: '2.1.0', winUnpacked: pc });
    assert.deepEqual(r.problems, ['Riftbound-Scanner-2.1.0.apk → assets/public/models/yolo11s-pose-riftbound-dyn-test.onnx : modèle d’essai (version de test)']);

    put('Riftbound-Scanner-2.1.0.apk', makeZip([['assets/public/index.html', 'x', true], ['assets/public/LICENSE.txt', 'l', false]]));
    put('keystore.properties', 'x');
    put('Riftbound-Scanner-Test.apk', makeZip([]));
    r = R.checkReleaseDir(dir, { version: '2.1.0', winUnpacked: pc });
    assert.ok(r.problems.includes('keystore.properties : mots de passe de la clé de signature'));
    assert.ok(r.problems.includes('Riftbound-Scanner-Test.apk : version de test (jamais dans un paquet)'));
    assert.ok(r.problems.includes('Riftbound-Scanner-2.1.0.apk : empreinte différente de EMPREINTES.txt'));
    assert.ok(r.problems.includes('keystore.properties : absent de EMPREINTES.txt'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(pc, { recursive: true, force: true });
  }
});

test('distribution APK: refused without the signing key, before anything is built', () => {
  const empty = mkdtempSync(join(tmpdir(), 'rb-nokey-'));
  try {
    const env = { ...process.env }; delete env.RB_KEYSTORE;
    const script = fileURLToPath(new URL('scripts/android-apk.mjs', root));
    const r = spawnSync(process.execPath, [script, '--release'], { cwd: empty, encoding: 'utf8', env });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Distribution refusée : pas de clé de signature/);
    const t = spawnSync(process.execPath, [script, '--release', '--test'], { cwd: empty, encoding: 'utf8', env });
    assert.equal(t.status, 1, 'never a test version');
  } finally { rmSync(empty, { recursive: true, force: true }); }
});

test('installed apps: not debuggable, no WebView inspection, no backup, no developer tools on PC', () => {
  const gradle = read('android/app/build.gradle');
  assert.doesNotMatch(gradle, /debuggable\s+true/);
  assert.match(gradle, /release \{[^}]*signingConfig signingConfigs\.release/);
  const cap = JSON.parse(read('capacitor.config.json'));
  assert.notEqual(cap.android?.webContentsDebuggingEnabled, true, 'Capacitor follows « debuggable »: off in release');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:allowBackup="false"/);
  assert.doesNotMatch(manifest, /android:debuggable="true"/);
  assert.match(read('electron/main.cjs'), /devTools: !app\.isPackaged \|\| VARIANT === 'test'/);
  assert.doesNotMatch(read('electron/main.cjs'), /openDevTools\(/);
  const ignore = read('android/.gitignore');
  assert.match(ignore, /^keystore\.properties$/m);
  assert.match(ignore, /^\*\.jks$/m);
});

// ─── LICENCE-ET-PUBLICATION.md, part 1: the MIT licence of the original project in every copy ───
test('LICENSE: the app under the AGPL-3.0 (full text), the original MIT notice word for word, the note on Riot outside both', () => {
  const lic = read('LICENSE').replace(/\r\n/g, '\n');
  const lines = lic.split('\n');
  assert.equal(lines[0], 'RiftMancer');
  assert.equal(lines[1], 'Copyright (C) 2026 FaZox');
  assert.match(lic, /under the terms of the GNU Affero General Public License as published\nby the Free Software Foundation, either version 3 of the License, or\n\(at your option\) any later version\./);
  assert.match(lic, /^ {20}GNU AFFERO GENERAL PUBLIC LICENSE\n {23}Version 3, 19 November 2007$/m, 'full AGPL text');
  assert.ok(lic.includes('END OF TERMS AND CONDITIONS'), 'AGPL text complete');
  assert.equal(pkg.license, 'AGPL-3.0-or-later');
  assert.match(lic, new RegExp(`^ {4}${R.ORIGIN_COPYRIGHT.replace(/[()]/g, '\\$&')}$`, 'm'), 'the line of the original project, unchanged');
  assert.match(read('THIRD_PARTY_LICENSES.md'), /## Ultralytics YOLO11 — AGPL-3\.0/);
  assert.match(lic, /Permission is hereby granted, free of charge, to any person obtaining a copy\n {4}of this software/);
  assert.match(lic, /The above copyright notice and this permission notice shall be included in all\n {4}copies or substantial portions of the Software\./);
  const end = lic.indexOf('OTHER DEALINGS IN THE\n    SOFTWARE.');
  assert.ok(end > 0, 'MIT text complete');
  assert.ok(lic.indexOf('Riot Games') > end && lic.indexOf('Riot Games') < lic.indexOf('GNU AFFERO GENERAL PUBLIC LICENSE\n'), 'the sentence on Riot is outside both licence texts');
  const third = read('THIRD_PARTY_LICENSES.md');
  assert.match(third, /## riftbound-scanner \(Nekoraru22\) — MIT/);
  assert.ok(third.includes(R.ORIGIN_COPYRIGHT) && third.includes('Permission is hereby granted'), 'full MIT text in the third-party licences');
  assert.match(read('README.md'), /^# RiftMancer\r?\n\r?\n> Based on \[riftbound-scanner\]\(https:\/\/github\.com\/Nekoraru22\/riftbound-scanner\) by Nekoraru22 \(MIT licence\)/);
  assert.match(read('scripts/copy-ort.mjs'), /join\(root, 'LICENSE'\), join\(root, 'public', 'LICENSE\.txt'\)/, 'shipped in the app (PC and APK)');
  assert.deepEqual(pkg.build.extraResources.map(r => r.from), ['LICENSE', 'THIRD_PARTY_LICENSES.md'], 'next to the installed PC app');
  assert.match(read('scripts/release.mjs'), /join\(out, 'LICENSE\.txt'\)/);
});

test('release:check refuses a package without the licence, or with a licence lacking the original line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rb-licence-'));
  try {
    const put = (name, content) => writeFileSync(join(dir, name), content);
    const sums = () => put('EMPREINTES.txt', R.checksumsText(['Riftbound-Scanner-2.1.1.apk', 'LICENSE.txt', 'THIRD_PARTY_LICENSES.txt']
      .filter(f => existsSync(join(dir, f))).map(name => ({ name, sha256: R.sha256(readFileSync(join(dir, name))) }))));
    put('Riftbound-Scanner-2.1.1.apk', makeZip([['assets/public/index.html', 'x', false]]));
    sums();
    let r = R.checkReleaseDir(dir, { version: '2.1.1' });
    assert.ok(r.problems.some(p => p.startsWith('LICENSE.txt manquant')));
    assert.ok(r.problems.some(p => p.startsWith('THIRD_PARTY_LICENSES.txt manquant')));
    assert.ok(r.problems.includes('Riftbound-Scanner-2.1.1.apk : LICENSE.txt absent de l’appli (Réglages → À propos → Licences)'));

    put('LICENSE.txt', `${R.APP_LICENCE_TITLE}\r\n\r\nCopyright (C) 2026 FaZox\r\n`); // the original line forgotten
    put('THIRD_PARTY_LICENSES.txt', 't');
    put('Riftbound-Scanner-2.1.1.apk', makeZip([['assets/public/index.html', 'x', false], ['assets/public/LICENSE.txt', 'l', false]]));
    sums();
    r = R.checkReleaseDir(dir, { version: '2.1.1' });
    assert.deepEqual(r.problems, [`LICENSE.txt : ligne « ${R.ORIGIN_COPYRIGHT} » absente`]);

    put('LICENSE.txt', read('LICENSE').replace(/\r?\n/g, '\r\n'));
    sums();
    assert.deepEqual(R.checkReleaseDir(dir, { version: '2.1.1' }).problems, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Réglages → À propos: credit to Nekoraru22 with the link, Riot Games mention in French and English, licences shown', () => {
  const about = read('src/components/settings/settingsSections.jsx');
  assert.match(about, /de Nekoraru22 \(licence MIT\), largement modifié et étendu/);
  assert.ok(about.includes('RiftMancer est un logiciel libre sous licence GNU AGPL-3.0'), 'free software, source code');
  assert.match(about, /https:\/\/github\.com\/Nekoraru22\/riftbound-scanner/);
  assert.ok(about.includes('RiftMancer a été créé selon la politique « Legal Jibber Jabber » de Riot Games en utilisant des éléments appartenant à Riot Games. Riot Games ne soutient ni ne sponsorise ce projet.'));
  assert.ok(about.includes('Riot Games does not endorse or sponsor this project.'));
  assert.ok(about.includes('Projet de fan gratuit et non commercial.'));
  assert.match(read('src/components/settings/RecognitionSection.jsx'), /read\('\/LICENSE\.txt'\)/, '« Licences » shows the app licence too');
  const guide = read('docs/LISEZ-MOI-AMIS.md');
  assert.ok(guide.includes('Riot Games does not endorse or sponsor this project.') && guide.includes('Nekoraru22'));
});
