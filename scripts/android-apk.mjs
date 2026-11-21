/**
 * Builds the Android APK (after `npm run build:mobile`), copies it to
 * release/RiftMancer.apk and installs it on the phone plugged in by
 * USB when there is one.
 *   npm run android:apk            → « RiftMancer »: signed RELEASE APK (minified, not debuggable)
 *   npm run android:apk:test       → « RiftMancer Test » (com.riftmancer.app.test), installed
 *                                    next to the other one: own data, own pairing
 *   … -- --debug                   → debug APK
 *   … -- --release                 → distribution (npm run release): refuses to build
 *                                    without the signing key, never installs, checks
 *                                    the APK is signed with that key and not debuggable
 *
 * Release needs a signing key: android/keystore.properties (git-ignored) or
 * the RB_KEYSTORE* environment variables — see README « APK signé (release) ».
 * Without one, a debug APK is built and a warning is shown.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const win = process.platform === 'win32';
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (win ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : '');
const signing = existsSync(path.resolve('android', 'keystore.properties')) || !!process.env.RB_KEYSTORE;
const wantDebug = process.argv.includes('--debug');
const test = process.argv.includes('--test');
const flavor = test ? 'beta' : 'daily'; // Gradle forbids a flavor named « test… »
const Flavor = test ? 'Beta' : 'Daily';
const distribution = process.argv.includes('--release');
if (distribution && (wantDebug || test)) {
  console.error('[android:apk] --release : seulement l’appli de tous les jours, en release.');
  process.exit(1);
}
if (distribution && !signing) {
  console.error('\n[android:apk] Distribution refusée : pas de clé de signature (android/keystore.properties).');
  console.error('              Crée-la avec l’annexe A d’AMELIORATIONS-APPLI.md.\n');
  process.exit(1);
}
const release = !wantDebug && signing;
if (!wantDebug && !signing) {
  console.warn('\n[android:apk] Pas de clé de signature (android/keystore.properties) : APK de DEBUG construit.');
  console.warn('              Voir README « APK signé (release) » pour créer la clé.\n');
}

// Full path: Windows may not run programs from the current folder.
const gradlew = path.resolve('android', win ? 'gradlew.bat' : 'gradlew');
const task = `assemble${Flavor}${release ? 'Release' : 'Debug'}`;
// « clean » first: incremental packaging leaves the space of removed files in the APK.
const gradle = spawnSync(`"${gradlew}"`, ['clean', task], { cwd: 'android', stdio: 'inherit', shell: true, env: { ...process.env, ANDROID_HOME: sdk } });
if (gradle.status !== 0) process.exit(gradle.status || 1);

const kind = release ? 'release' : 'debug';
const built = path.resolve(`android/app/build/outputs/apk/${flavor}/${kind}/app-${flavor}-${kind}.apk`);
// Copied next to the PC installer: release/RiftMancer.apk
mkdirSync('release', { recursive: true });
const apk = path.resolve('release', test ? 'RiftMancer-Test.apk' : 'RiftMancer.apk');
copyFileSync(built, apk);
console.log(`\nAPK ${test ? 'TEST ' : ''}(${release ? 'release signé' : 'debug'}) : ${apk}`);
if (distribution) {
  checkDistribution(apk);
  process.exit(0); // never installed from here: the APK goes into release/v<version>/
}
// --no-install: build only (the APK is copied to the phone by hand)
if (process.argv.includes('--no-install')) process.exit(0);
const adb = path.join(sdk, 'platform-tools', win ? 'adb.exe' : 'adb');
if (!existsSync(adb)) process.exit(0);
const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' }).stdout || '';
if (!/\tdevice\b/.test(devices)) {
  console.log('Aucun téléphone branché en USB : copiez l’APK sur le téléphone pour l’installer.');
  process.exit(0);
}
const inst = spawnSync(adb, ['install', '-r', apk], { encoding: 'utf8' });
process.stdout.write(inst.stdout || '');
if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE/.test((inst.stdout || '') + (inst.stderr || ''))) {
  console.error('\nLe téléphone a une version signée avec une autre clé (debug ↔ release).');
  console.error('Synchronisez ou sauvegardez la collection, désinstallez l’app du téléphone, puis relancez.');
  process.exit(1);
}
process.stderr.write(inst.stderr || '');
process.exit(inst.status || 0);

/**
 * Distribution: the APK must be signed with the distribution key (not the
 * debug one) and not debuggable — so the WebView cannot be inspected either
 * (Capacitor turns WebView debugging on only for debuggable apps).
 * Nothing personal is printed: only the certificate's SHA-256.
 */
function checkDistribution(file) {
  const dir = path.join(sdk, 'build-tools');
  const versions = existsSync(dir) ? readdirSync(dir).filter(v => /^\d/.test(v))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : [];
  if (!versions.length) { console.error('[android:apk] build-tools introuvables : vérification impossible.'); process.exit(1); }
  const tools = path.join(dir, versions.at(-1));
  const javaHome = process.env.JAVA_HOME || (win ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : '');
  const env = { ...process.env, JAVA_HOME: javaHome, PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH}` };
  const signer = spawnSync(`"${path.join(tools, win ? 'apksigner.bat' : 'apksigner')}"`, ['verify', '--print-certs', `"${file}"`], { encoding: 'utf8', shell: true, env });
  const certs = signer.stdout || '';
  if (signer.status !== 0) { console.error('[android:apk] Signature de l’APK invalide.'); process.stderr.write(signer.stderr || ''); process.exit(1); }
  if (/CN=Android Debug/i.test(certs)) { console.error('[android:apk] APK signé avec la clé de DEBUG : refusé.'); process.exit(1); }
  const digest = /certificate SHA-256 digest:\s*([0-9a-f]{64})/i.exec(certs)?.[1];
  const badging = spawnSync(path.join(tools, win ? 'aapt.exe' : 'aapt'), ['dump', 'badging', file], { encoding: 'utf8' });
  if (badging.status !== 0) { console.error('[android:apk] Lecture du manifeste impossible (aapt).'); process.exit(1); }
  if (/application-debuggable/.test(badging.stdout)) { console.error('[android:apk] APK débogable : refusé.'); process.exit(1); }
  const pkg = /package: name='([^']+)'.*versionName='([^']*)'/.exec(badging.stdout);
  console.log(`Vérifié : ${pkg?.[1]} ${pkg?.[2]}, non débogable, signé avec la clé de distribution (certificat ${digest ? digest.slice(0, 16) + '…' : '?'}).`);
}
