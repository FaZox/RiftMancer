/**
 * Format of the bench photos collected in the app (MODULE-BANC.md): labels,
 * file names, export tree read by scripts/eval-detector.mjs and
 * scripts/photos-prepare.mjs, `_collecte.json`. Pure functions (browser and
 * Node, tested in tests/bench.test.mjs).
 *
 * Golden rule (0): no card is saved without a human decision. Each card has
 *   final    the card on the photo, as written for the bench (printed code
 *            « OGN-042 », or the card id when the code cannot name it)
 *   finalId  its catalog id, null for a card missing from the catalog
 *   scanner  the scanner's own answer (same form), null when it found nothing
 *   level    the scanner's level ('sure' | 'probable' | 'uncertain'), or null
 *   label    'confirmé' (scanner right, confirmed by a tap), 'corrigé'
 *            (scanner wrong, corrected) or 'ajouté' (card the scanner missed)
 *
 * Export tree:
 *   <CODE>/<name>.jpg             one card per photo
 *   grilles/<name>.jpg + .txt     several cards, one code per line
 *   _collecte.json                metadata, one entry per photo
 */

export const LABELS = ['confirmé', 'corrigé', 'ajouté'];
export const TYPES = ['carte', 'grille'];
export const SOURCES = ['photo', 'camera', 'scan-hesitant'];
export const LEVELS = ['sure', 'probable', 'uncertain'];
export const GRID_DIR = 'grilles';
export const COLLECTE_FILE = '_collecte.json';

/**
 * Printed code that can name a folder: « OGN-042 », « SFD-T02 », « UNL-150a »
 * (letter suffix in lower case, as in the catalog: one spelling only, since
 * Windows folders ignore the case).
 */
export const CODE_RE = /^[A-Z0-9]{2,4}-(?=[A-Za-z0-9]{1,5}$)(?:[A-Z]*\d+[a-z]*|[A-Z0-9]{1,4})$/;
/** Catalog id: « ogn-042-298 », « ogn-299-star-298 ». */
export const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)+$/;
/** Generated photo names: date, time, 4 random characters. */
export const NAME_RE = /^\d{8}_\d{6}_[a-z0-9]{4}$/;

/** « OGN-042/298 » → « OGN-042 », « unl-150A » → « UNL-150a » (canonical spelling). */
export function printedCode(code) {
  const c = String(code || '').toUpperCase().split('/')[0].trim();
  return c.replace(/^([A-Z0-9]+-[A-Z]*\d+)([A-Z]+)$/, (_, a, b) => a + b.toLowerCase());
}

/**
 * Printed code → catalog ids, to know whether a code names one card only
 * (the scripts' cardIdOf requires a unique match).
 * @param {{ id: string, code?: string }[]} cards
 */
export function codeIndex(cards) {
  const byCode = new Map();
  const ids = new Set();
  for (const c of cards) {
    ids.add(c.id);
    const k = printedCode(c.code);
    if (!k) continue;
    if (!byCode.has(k)) byCode.set(k, []);
    byCode.get(k).push(c.id);
  }
  return { byCode, ids };
}

/**
 * How a card is written for the bench (folder name, line of a grid list):
 * its printed code when that code names it alone and is a valid folder name,
 * otherwise its id (« ogn-299-star-298 » — the scripts accept both).
 * `card`: a catalog card ({ id, code }).
 */
export function benchKey(card, index) {
  const code = printedCode(card.code);
  if (CODE_RE.test(code) && index.byCode.get(code)?.length === 1) return code;
  return card.id;
}

/**
 * A code typed by hand for a card missing from the catalog (« SFD-T02 »):
 * normalised, or null when it cannot be one.
 */
export function normalizeFreeCode(text) {
  const c = printedCode(String(text || '').replace(/\s+/g, ''));
  return CODE_RE.test(c) ? c : null;
}

/** Label of a card from the scanner's answer and the final one (ids or codes). */
export function labelFor(final, scanner) {
  if (!scanner) return 'ajouté';
  return final === scanner ? 'confirmé' : 'corrigé';
}

/**
 * Checks a photo before it is saved or exported. Throws an error (in French,
 * shown to the user) when a card has no human decision or is inconsistent.
 */
export function assertLabeled(item) {
  if (!item || !NAME_RE.test(item.name || '')) throw new Error('Photo sans nom valide.');
  if (!TYPES.includes(item.type)) throw new Error(`Type de photo inconnu : ${item.type}`);
  if (!SOURCES.includes(item.source)) throw new Error(`Source inconnue : ${item.source}`);
  if (!['test', 'calib'].includes(item.split)) throw new Error('Tirage test / calib manquant.');
  const cards = item.cards || [];
  if (!cards.length) throw new Error('Aucune carte confirmée sur cette photo.');
  if (item.type === 'carte' && cards.length !== 1) throw new Error('Une photo « carte seule » contient exactement une carte.');
  cards.forEach((c, i) => {
    const n = `Carte ${i + 1}`;
    if (!LABELS.includes(c?.label)) throw new Error(`${n} : pas encore confirmée ni corrigée.`);
    if (!c.final || !(CODE_RE.test(c.final) || ID_RE.test(c.final))) throw new Error(`${n} : code invalide (${c.final || 'vide'}).`);
    if (c.label === 'ajouté' && c.scanner) throw new Error(`${n} : « ajoutée » alors que le scanner l’avait trouvée.`);
    if (c.label !== 'ajouté' && !c.scanner) throw new Error(`${n} : réponse du scanner manquante.`);
    if (c.label === 'confirmé' && c.final !== c.scanner) throw new Error(`${n} : « confirmée » mais différente de la réponse du scanner.`);
    if (c.label === 'corrigé' && c.final === c.scanner) throw new Error(`${n} : « corrigée » mais identique à la réponse du scanner.`);
    if (c.level != null && !LEVELS.includes(c.level)) throw new Error(`${n} : niveau inconnu (${c.level}).`);
  });
  return item;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Local date and time « 2026-11-14T16:02:33 » (as in _collecte.json). */
export function localIso(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 4 random characters (crypto). */
export function randomSuffix(rand = cryptoBytes) {
  const b = rand(4);
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

function cryptoBytes(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/**
 * New photo name « 20261114_160233_e5f6 », different from every name in
 * `taken` (Set): never two photos with the same name, even across exports.
 */
export function newPhotoName(date = new Date(), taken = new Set(), rand = cryptoBytes) {
  const d = new Date(date);
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  for (let k = 0; k < 1000; k++) {
    const name = `${stamp}_${randomSuffix(rand)}`;
    if (!taken.has(name)) return name;
  }
  throw new Error('Impossible de trouver un nom de photo libre.');
}

/** « test » (≈ 70 %) or « calib » (≈ 30 %), drawn once when the photo is created. */
export function drawSplit(rand = cryptoBytes) {
  const b = rand(2);
  return ((b[0] << 8) | b[1]) / 65536 < 0.7 ? 'test' : 'calib';
}

/** Path of a photo in the export (without the extension). */
export function photoPath(item) {
  return item.type === 'grille' ? `${GRID_DIR}/${item.name}` : `${item.cards[0].final}/${item.name}`;
}

/** Grid list: one code per line, repeated for duplicates, « \n » line ends. */
export function gridText(item) {
  return item.cards.map(c => c.final.toUpperCase()).join('\n') + '\n';
}

/** Entry of _collecte.json for one photo (MODULE-BANC.md 4.2). */
export function collecteEntry(item) {
  return {
    file: `${photoPath(item)}.jpg`,
    type: item.type,
    source: item.source,
    date: item.date,
    appVersion: item.appVersion || null,
    detector: item.detector || null,
    engine: item.engine || null,
    thresholds: item.thresholds || null,
    split: item.split,
    cards: item.cards.map(c => ({
      final: c.final,
      finalId: c.finalId ?? null,
      scanner: c.scanner ?? null,
      scannerId: c.scannerId ?? null,
      level: c.level ?? null,
      label: c.label,
    })),
    rejectedBoxes: item.rejectedBoxes || 0,
  };
}

const baseName = (file) => String(file).split('/').pop();

/**
 * Merges new entries into an existing _collecte.json (array): nothing is
 * lost. A photo exported again (same name, maybe corrected and so moved to
 * another folder) replaces its old entry.
 * @returns {object[]}
 */
export function mergeCollecte(existing, entries) {
  const out = Array.isArray(existing) ? [...existing] : [];
  const at = new Map(out.map((e, i) => [baseName(e.file), i]));
  for (const e of entries) {
    const k = baseName(e.file);
    if (at.has(k)) out[at.get(k)] = e;
    else { at.set(k, out.length); out.push(e); }
  }
  return out;
}

/**
 * Files of an export: [{ path, kind: 'photo' | 'text', item?, text? }] (photos
 * read later, by name) and the _collecte.json entries. Every photo is checked
 * (assertLabeled) first.
 */
export function exportPlan(items) {
  const files = [];
  const entries = [];
  const seen = new Set();
  for (const item of items) {
    assertLabeled(item);
    if (seen.has(item.name)) throw new Error(`Deux photos portent le même nom : ${item.name}`);
    seen.add(item.name);
    const base = photoPath(item);
    files.push({ path: `${base}.jpg`, kind: 'photo', item });
    if (item.type === 'grille') files.push({ path: `${base}.txt`, kind: 'text', text: gridText(item) });
    entries.push(collecteEntry(item));
  }
  return { files, entries };
}

/** Is `p` a path an export may contain (checked before writing on the PC)? */
export function isBenchPath(p) {
  if (typeof p !== 'string' || p.includes('\\') || p.includes('..') || p.startsWith('/')) return false;
  if (p === COLLECTE_FILE) return true;
  const parts = p.split('/');
  if (parts.length !== 2) return false;
  const [dir, file] = parts;
  const m = /^(.+)\.(jpg|txt)$/.exec(file);
  if (!m || !NAME_RE.test(m[1])) return false;
  if (dir === GRID_DIR) return true;
  return m[2] === 'jpg' && (CODE_RE.test(dir) || ID_RE.test(dir));
}

/** « 12 cartes : 9 confirmées, 2 corrigées, 1 ajoutée à la main ». */
export function cardsSummary(cards) {
  const n = { 'confirmé': 0, 'corrigé': 0, 'ajouté': 0 };
  for (const c of cards) if (n[c.label] != null) n[c.label]++;
  const s = (k, one, many) => `${n[k]} ${n[k] > 1 ? many : one}`;
  const parts = [s('confirmé', 'confirmée', 'confirmées'), s('corrigé', 'corrigée', 'corrigées'), `${s('ajouté', 'ajoutée', 'ajoutées')} à la main`];
  const undecided = cards.length - n['confirmé'] - n['corrigé'] - n['ajouté'];
  if (undecided) parts.push(`${undecided} à confirmer`);
  return `${cards.length} carte${cards.length > 1 ? 's' : ''} : ${parts.join(', ')}`;
}

/** Counters of « Ma collecte ». */
export function collectStats(items) {
  let cards = 0; let corrected = 0; let outside = 0; let grids = 0;
  for (const it of items) {
    if (it.type === 'grille') grids++;
    for (const c of it.cards) {
      cards++;
      if (c.label === 'corrigé') corrected++;
      if (!c.finalId) outside++;
    }
  }
  return { photos: items.length, grids, cards, corrected, outside };
}

/** Status of a photo in « Ma collecte »: the « worst » label of its cards. */
export function itemStatus(item) {
  if (item.cards.some(c => c.label === 'corrigé')) return 'corrigé';
  if (item.cards.some(c => c.label === 'ajouté')) return 'ajouté';
  return 'confirmé';
}
