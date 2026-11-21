/**
 * Distribution package (lot 2.2 of AMELIORATIONS-APPLI.md): pure helpers for
 * `npm run release` and `npm run release:check`, tested in tests/release.test.mjs.
 *   - versions: one source (package.json), every distribution goes up;
 *   - NOUVEAUTES.txt from docs/NOUVEAUTES.md, EMPREINTES.txt (SHA-256);
 *   - what must never be in a package (signing key, user data, bench data…),
 *     looked for in the files of the folder, inside the APK (zip) and inside
 *     the PC app (app.asar).
 */
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Versions ───────────────────────────────────────────────────────────────

/** « 2.1.0 » → [2, 1, 0]; null when it is not three plain numbers. */
export function parseVersion(v) {
  const m = /^(\d{1,3})\.(\d{1,2})\.(\d{1,2})$/.exec(String(v || '').trim());
  return m ? m.slice(1).map(Number) : null;
}

export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** Android versionCode, as android/app/build.gradle computes it. */
export const versionCode = (v) => { const [a, b, c] = parseVersion(v); return a * 10000 + b * 100 + c; };

/**
 * Can `version` be distributed? `current` is package.json's version, `released`
 * the versions already distributed (git tags v*, folders release/v*).
 * Returns null when it can, else the reason (French, shown as is).
 */
export function versionProblem(version, current, released = []) {
  if (!parseVersion(version)) return `« ${version} » n’est pas une version (attendu : trois nombres, par exemple 2.2.0).`;
  const done = released.filter(parseVersion);
  if (done.some(r => compareVersions(r, version) === 0)) return `La version ${version} a déjà été distribuée.`;
  const last = done.sort(compareVersions).at(-1);
  if (last && compareVersions(version, last) < 0) return `La version ${version} est plus ancienne que la dernière distribuée (${last}).`;
  if (parseVersion(current) && compareVersions(version, current) < 0) return `La version ${version} est plus ancienne que celle du projet (${current}).`;
  return null;
}

/** Versions in names such as « v2.1.0 » (git tags, release folders). */
export const versionsIn = (names) => names.map(n => /^v(\d+\.\d+\.\d+)$/.exec(n.trim())?.[1]).filter(Boolean);

// ── Texts of the package ───────────────────────────────────────────────────

/**
 * The section « ## 2.2.0 » of docs/NOUVEAUTES.md (title line may go on:
 * « ## 2.2.0 — 1er décembre 2026 »), as plain text. null when missing or empty.
 */
export function releaseNotes(md, version) {
  const lines = String(md).split(/\r?\n/);
  const head = new RegExp(`^##\\s+v?${version.replace(/\./g, '\\.')}(\\s|$)`);
  const start = lines.findIndex(l => head.test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join('\n').trim();
  if (!body) return null;
  const title = lines[start].replace(/^##\s+v?/, '').trim();
  return `RiftMancer ${title}\n\n${body}\n`;
}

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** EMPREINTES.txt: one « <sha256>  <file> » line per file (sha256sum format), with how to check. */
export function checksumsText(files) {
  const lines = files.map(f => `${f.sha256}  ${f.name}`);
  return [
    'Empreintes SHA-256 des fichiers de cette version.',
    'Pour vérifier un fichier sur Windows (PowerShell) :',
    '  Get-FileHash "<fichier>" -Algorithm SHA256',
    'Le résultat doit être identique à la ligne du fichier ci-dessous (majuscules ou minuscules, peu importe).',
    '',
    ...lines,
    '',
  ].join('\r\n');
}

// ── What must never be distributed ─────────────────────────────────────────

const FORBIDDEN = [
  [/\.jks$|\.keystore$|\.p12$/, 'clé de signature'],
  [/\.pem$|pack-signing-key/, 'clé privée (packs)'],
  [/(^|\/)keystore\.properties$/, 'mots de passe de la clé de signature'],
  [/\.sqlite3?(-wal|-shm|-journal)?$|\.db$/, 'base de données'],
  [/(^|\/)real-photos/, 'photos du banc'],
  [/(^|\/)sauvegarde-modeles(\/|$)/, 'modèles de sauvegarde'],
  [/(^|\/)model\/runs(\/|$)/, 'entraînements des modèles'],
  [/\.pt$/, 'modèle d’entraînement (.pt)'],
  [/(^|\/)\.env(\.[\w-]+)?$/, 'fichier .env'],
  [/(^|\/)_collecte\.json$|(^|\/)banc-collecte-[^/]*\.zip$/, 'données de collecte du banc'],
  [/-test\.onnx$/, 'modèle d’essai (version de test)'],
];

/** Why `path` must not be in a package, or null. */
export function forbiddenReason(path) {
  const p = String(path).replace(/\\/g, '/').toLowerCase();
  for (const [re, why] of FORBIDDEN) if (re.test(p)) return why;
  return null;
}

/** Problems of a list of paths: [{ path, why }]. `where` prefixes the path (« Riftbound.apk: »). */
export function forbiddenIn(paths, where = '') {
  return paths.map(p => ({ path: where + p, why: forbiddenReason(p) })).filter(x => x.why);
}

// ── Reading a zip (APK) and an asar (PC app) without extracting them ───────

/** Entries of a zip file: [{ name, method, compressedSize, offset }] (central directory). */
export function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('fichier zip illisible');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('fichier zip illisible');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    out.push({ name: buf.toString('utf8', p + 46, p + 46 + nameLen), method, compressedSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Content of one zip entry (stored or deflated). */
export function zipRead(buf, entry) {
  const p = entry.offset;
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(start, start + entry.compressedSize);
  return entry.method === 0 ? data : inflateRawSync(data);
}

/**
 * Files of an Electron app.asar: { files: [path], read(path) }. Format: a
 * pickled uint32 (size of the header pickle), then the header pickle (payload
 * size, string length, JSON); file data starts after both.
 */
export function asarFiles(buf) {
  const headerSize = buf.readUInt32LE(4);
  const jsonLen = buf.readUInt32LE(12);
  const header = JSON.parse(buf.toString('utf8', 16, 16 + jsonLen));
  const base = 8 + headerSize;
  const index = new Map();
  const walk = (node, prefix) => {
    for (const [name, child] of Object.entries(node.files || {})) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (child.files) walk(child, path);
      else index.set(path, child);
    }
  };
  walk(header, '');
  return {
    files: [...index.keys()],
    read(path) {
      const f = index.get(path);
      if (!f || f.unpacked) return null;
      const at = base + Number(f.offset);
      return buf.subarray(at, at + f.size);
    },
  };
}

/**
 * The package's PC app must be the everyday one: package.json in app.asar
 * with « variant: daily » and the expected version. Returns problems [string].
 */
export function checkPcApp(asar, version) {
  const raw = asar.read('package.json');
  if (!raw) return ['package.json introuvable dans app.asar'];
  const pkg = JSON.parse(raw.toString('utf8'));
  const out = [];
  if (pkg.variant !== 'daily') out.push(`appli PC « ${pkg.variant || '?'} » au lieu de l’appli de tous les jours`);
  if (version && pkg.version !== version) out.push(`appli PC en version ${pkg.version} au lieu de ${version}`);
  return out;
}

// ── Checking a package folder (npm run release:check) ──────────────────────

const listFiles = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? listFiles(join(dir, d.name), `${prefix}${d.name}/`) : [`${prefix}${d.name}`]);

/**
 * Checks a folder release/v<version>/: forbidden files, test versions, inside
 * the APK, inside the PC app (`winUnpacked`: electron-builder's unpacked app of
 * the same build) and EMPREINTES.txt. Returns { problems: [string], notes: [string] }.
 */
/**
 * The MIT licence of the original project (riftbound-scanner by Nekoraru22) must be in
 * every copy (LICENCE-ET-PUBLICATION.md): its copyright line, word for word.
 */
export const ORIGIN_COPYRIGHT = 'Copyright (c) 2026 Nekoraru22';
/** The app's licence (the detector is trained with Ultralytics YOLO11, AGPL-3.0). */
export const APP_LICENCE_TITLE = 'GNU AFFERO GENERAL PUBLIC LICENSE';

/** What is missing for the licence in a package folder (files: its file names). */
export function licenceProblems(dir, files) {
  const problems = [];
  if (!files.includes('LICENSE.txt')) problems.push('LICENSE.txt manquant (licence GNU AGPL-3.0 de l’appli)');
  else if (!readFileSync(join(dir, 'LICENSE.txt'), 'utf8').includes(APP_LICENCE_TITLE)) problems.push('LICENSE.txt : texte de la licence AGPL-3.0 absent');
  if (!files.includes('NOTICE.txt')) problems.push('NOTICE.txt manquant (avis MIT du projet d’origine, obligatoire dans toute copie)');
  else if (!readFileSync(join(dir, 'NOTICE.txt'), 'utf8').includes(ORIGIN_COPYRIGHT)) problems.push(`NOTICE.txt : ligne « ${ORIGIN_COPYRIGHT} » absente`);
  if (!files.includes('THIRD_PARTY_LICENSES.txt')) problems.push('THIRD_PARTY_LICENSES.txt manquant (licences des modèles d’IA et du code repris)');
  return problems;
}

export function checkReleaseDir(dir, { version, winUnpacked } = {}) {
  const problems = [], notes = [];
  const bad = (list) => { for (const x of list) problems.push(`${x.path} : ${x.why}`); };
  const files = listFiles(dir);
  bad(forbiddenIn(files));
  problems.push(...licenceProblems(dir, files));
  for (const f of files) {
    if (/test/i.test(f)) problems.push(`${f} : version de test (jamais dans un paquet)`);
    if (f.toLowerCase().endsWith('.apk')) {
      const buf = readFileSync(join(dir, f));
      const names = zipEntries(buf).map(e => e.name);
      bad(forbiddenIn(names, `${f} → `));
      for (const n of ['LICENSE.txt', 'NOTICE.txt']) if (!names.includes(`assets/public/${n}`)) problems.push(`${f} : ${n} absent de l’appli (Réglages → À propos → Licences)`);
    }
  }
  if (files.some(f => f.toLowerCase().endsWith('.exe'))) {
    const asarPath = winUnpacked && join(winUnpacked, 'resources', 'app.asar');
    if (!asarPath || !existsSync(asarPath)) {
      notes.push('Appli PC non vérifiée de l’intérieur : release/win-unpacked absent.');
    } else {
      const asar = asarFiles(readFileSync(asarPath));
      const pcProblems = checkPcApp(asar, version);
      if (version && pcProblems.some(p => p.includes('en version'))) {
        notes.push(`Appli PC non vérifiée de l’intérieur : release/win-unpacked est d’une autre version.`);
      } else {
        problems.push(...pcProblems.map(p => `appli PC : ${p}`));
        for (const n of ['LICENSE.txt', 'NOTICE.txt']) {
          if (!asar.files.includes(`dist/${n}`)) problems.push(`appli PC : ${n} absent de l’appli (Réglages → À propos → Licences)`);
          if (!existsSync(join(winUnpacked, 'resources', n))) problems.push(`appli PC : ${n} absent du dossier installé`);
        }
        bad(forbiddenIn(asar.files, 'appli PC → '));
        bad(forbiddenIn(listFiles(winUnpacked), 'appli PC (dossier) → '));
      }
    }
  }
  const sums = join(dir, 'EMPREINTES.txt');
  if (!existsSync(sums)) problems.push('EMPREINTES.txt manquant');
  else {
    const listed = new Map(readFileSync(sums, 'utf8').split(/\r?\n/)
      .map(l => /^([0-9a-f]{64}) {2}(.+)$/.exec(l)).filter(Boolean).map(m => [m[2], m[1]]));
    for (const f of files.filter(f => f !== 'EMPREINTES.txt')) {
      if (!listed.has(f)) problems.push(`${f} : absent de EMPREINTES.txt`);
      else if (listed.get(f) !== sha256(readFileSync(join(dir, f)))) problems.push(`${f} : empreinte différente de EMPREINTES.txt`);
    }
  }
  return { problems, notes };
}
