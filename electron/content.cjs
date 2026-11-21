/**
 * Content updated from the PC app (lot 4.1 of AMELIORATIONS-APPLI.md): a
 * catalog in layers.
 *
 * The content shipped with the app (dist/card-hashes.json, dist/banlist.json,
 * dist/cards/) is the BASE. Updates are LAYERS in userData/catalogue/couches/:
 *   cartes/       new or changed cards (data, images, thumbnails, colour
 *                 fingerprints, AI signatures), cards to remove
 *   traductions/  French names and texts (riftboundfr.fr)
 *   bannies/      the banned cards list
 * Each layer is a folder with layer.json:
 *   { kind, format: 1, createdAt (ISO), source: { label, url? }, count,
 *     baseGeneratedAt, data, files: { 'cards/<id>.webp': sha256, … } }
 *
 * The app reads the base, then the layers: rebuild() writes the merged
 * card-hashes.json / banlist.json in userData/catalogue/actif/, which the
 * local server serves instead of the base ones (the PC window and the phone
 * at sync time, existing mechanism: version = SHA-256). A layer that cannot be
 * read is ignored WITH A MESSAGE; a layer older than the base of a new app
 * version is removed (its content is in the base). reset() removes them all.
 *
 * Pure Node (no Electron): tested in tests/content.test.cjs.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { etx } = require('./i18n.cjs');
const { canonDetector } = require('./pack.cjs');

const KINDS = ['cartes', 'traductions', 'bannies'];
const LABEL = { cartes: 'Cartes', traductions: 'Traductions françaises', bannies: 'Cartes bannies' }; // French keys of electron/i18n.cjs
const FILE_PATH = /^cards\/(thumbs\/)?[a-z0-9][a-z0-9-]{1,60}\.webp$/;
const CARD_ID = /^[a-z0-9][a-z0-9-]{1,60}$/;
const MAX_TEXT = 4000;
// Fields a « patch » may change on a card of the catalog (gallery changes, full
// English names, reprint groups — lot 4.2), and their type.
const PATCH_FIELDS = {
  name: 'string', nameEn: 'string', number: 'number', code: 'string', set: 'string', setName: 'string',
  domains: 'array', domain: 'string', rarity: 'string', type: 'string', superTypes: 'array', signature: 'boolean',
  energy: 'number', might: 'number', tags: 'array', illustrator: 'string', text: 'string', orientation: 'string',
  artGroup: 'string',
};
const typeOf = (v) => (Array.isArray(v) ? 'array' : typeof v);

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const isDate = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/** Why a layer cannot be used, or null. `dir`: its folder (files checked against their SHA-256). */
function layerProblem(layer, kind, dir) {
  if (!layer || typeof layer !== 'object') return 'fichier illisible';
  if (layer.kind !== kind) return 'type de couche inattendu';
  if (layer.format !== 1) return 'format inconnu (appli trop ancienne ?)';
  if (!isDate(layer.createdAt)) return 'date manquante';
  const d = layer.data;
  if (!d || typeof d !== 'object') return 'contenu manquant';
  if (kind === 'cartes') {
    if (!Array.isArray(d.cards)) return 'liste des cartes manquante';
    for (const c of d.cards) {
      if (!c || !CARD_ID.test(c.id || '') || typeof c.name !== 'string' || typeof c.f !== 'string') return `carte invalide (${c?.id || '?'})`;
    }
    if (d.removed && (!Array.isArray(d.removed) || d.removed.some(id => !CARD_ID.test(id || '')))) return etx('liste des cartes retirées invalide');
    if (d.patches !== undefined) {
      if (!Array.isArray(d.patches)) return 'corrections invalides';
      for (const p of d.patches) {
        if (!p || !CARD_ID.test(p.id || '')) return 'correction invalide';
        for (const [k, v] of Object.entries(p)) {
          if (k === 'id') continue;
          if (!PATCH_FIELDS[k] || (v !== null && typeOf(v) !== PATCH_FIELDS[k]) || (typeof v === 'string' && v.length > MAX_TEXT)) return etx('correction refusée ({id})', { id: `${p.id}.${k}` });
        }
      }
    }
  } else if (kind === 'traductions') {
    for (const key of ['names', 'texts']) {
      const o = d[key];
      if (!o || typeof o !== 'object' || Array.isArray(o)) return `${key === 'names' ? 'noms' : 'textes'} manquants`;
      for (const [id, v] of Object.entries(o)) {
        if (!CARD_ID.test(id) || typeof v !== 'string' || v.length > MAX_TEXT) return `traduction invalide (${id})`;
      }
    }
  } else if (kind === 'bannies') {
    if (!d.formats || typeof d.formats !== 'object' || !d.formats.standard || !Array.isArray(d.formats.standard.banned)) return 'liste des cartes bannies invalide';
    if (!isDate(d.updatedAt)) return 'date de la liste manquante';
  }
  for (const [rel, hash] of Object.entries(layer.files || {})) {
    if (!FILE_PATH.test(rel)) return etx('nom de fichier refusé ({rel})', { rel });
    let buf;
    try { buf = fs.readFileSync(path.join(dir, rel)); } catch { return `fichier manquant (${rel})`; }
    if (sha256(buf) !== hash) return etx('fichier altéré ({rel})', { rel });
  }
  return null;
}

/** Applies the layers' data to the base catalog (pure). */
function mergeCatalog(base, layers) {
  const out = { ...base, cards: base.cards.map(c => ({ ...c })) };
  const cards = layers.cartes?.data;
  if (cards) {
    const removed = new Set(cards.removed || []);
    const byId = new Map(out.cards.filter(c => !removed.has(c.id)).map(c => [c.id, c]));
    for (const c of cards.cards) byId.set(c.id, { ...byId.get(c.id), ...c });
    for (const p of cards.patches || []) {
      const c = byId.get(p.id);
      if (!c) continue;
      for (const [k, v] of Object.entries(p)) {
        if (k === 'id') continue;
        if (v === null) delete c[k]; else c[k] = v;
      }
    }
    out.cards = [...byId.values()];
  }
  const tr = layers.traductions?.data;
  if (tr) {
    for (const c of out.cards) {
      if (tr.names[c.id]) c.nameFr = tr.names[c.id];
      if (tr.texts[c.id]) c.textFr = tr.texts[c.id];
    }
  }
  const dates = [base.generatedAt, ...Object.values(layers).map(l => l.createdAt)].filter(isDate).sort();
  out.generatedAt = dates.at(-1) || base.generatedAt;
  // What the phone shows in Réglages → Contenu (read only).
  out.content = Object.fromEntries(Object.entries(layers).map(([k, l]) => [k, { createdAt: l.createdAt, source: l.source || null, count: l.count ?? null }]));
  return out;
}

/**
 * Errata (lot 7.6): the rules texts that an update changed — English `text`
 * and French `textFr`. A text that appears (none before) is not an erratum.
 * [{ id, field, old, new, at }] (pure).
 */
const ERRATA_FIELDS = ['text', 'textFr'];
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
function textChanges(before, after, at) {
  const old = new Map(before.cards.map(c => [c.id, c]));
  const out = [];
  for (const c of after.cards) {
    const o = old.get(c.id);
    if (!o) continue;
    for (const field of ERRATA_FIELDS) {
      if (o[field] && c[field] && norm(o[field]) !== norm(c[field])) out.push({ id: c.id, field, old: o[field], new: c[field], at });
    }
  }
  return out;
}

/** Keeps the errata on the cards whose text is still the changed one (pure). */
function applyErrata(catalog, errata) {
  if (!errata || !Object.keys(errata).length) return catalog;
  return {
    ...catalog,
    cards: catalog.cards.map(c => {
      const list = (errata[c.id] || []).filter(e => c[e.field] === e.new);
      if (!list.length) return c;
      // the last change of each text
      const last = ERRATA_FIELDS.map(f => list.filter(e => e.field === f).at(-1)).filter(Boolean);
      return { ...c, errata: last.map(e => ({ field: e.field, old: e.old, at: e.at })) };
    }),
  };
}

function createContent({ dir, distDir }) {
  const layersDir = path.join(dir, 'couches');
  const activeDir = path.join(dir, 'actif');
  let messages = [];
  let active = {}; // kind → layer (valid, applied)

  const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const stateFile = path.join(dir, 'etat.json');
  /** Weekly checks (lot 4.2 / 4.3): { traductions: { weekly, lastCheck, validators, lastReminder }, … } */
  function getState() { try { return readJSON(stateFile); } catch { return {}; } }
  function setState(s) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(s)); }
  // The catalog shipped with the app; an app built without the card content
  // ships only its header (dist/catalog-base.json, no card): the cards come
  // on first launch (gallery download or importFolder below).
  const baseFile = () => {
    const full = path.join(distDir, 'card-hashes.json');
    return fs.existsSync(full) ? full : path.join(distDir, 'catalog-base.json');
  };
  const base = () => readJSON(baseFile());
  const baseBanlist = () => { try { return readJSON(path.join(distDir, 'banlist.json')); } catch { return null; } };
  const errataFile = path.join(dir, 'errata.json');
  function getErrata() { try { return readJSON(errataFile); } catch { return {}; } }
  /** The catalog as served now (base and active layers). */
  const mergedNow = () => (active.cartes || active.traductions ? mergeCatalog(base(), active) : base());
  /** After an install: the texts it changed are kept (5 changes per card at most). */
  function recordErrata(before) {
    const changes = textChanges(before, mergedNow(), new Date().toISOString());
    if (!changes.length) return false;
    const errata = getErrata();
    for (const e of changes) errata[e.id] = [...(errata[e.id] || []), { field: e.field, old: e.old, new: e.new, at: e.at }].slice(-5);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(errataFile, JSON.stringify(errata));
    return true;
  }

  /** Is the layer older than what this app version ships? (Its content is then in the base.) */
  function outdated(kind, layer, b, banlist) {
    if (kind === 'bannies') return !!banlist?.updatedAt && layer.data.updatedAt <= banlist.updatedAt;
    return isDate(b.generatedAt) && layer.createdAt <= b.generatedAt;
  }

  function rebuild() {
    messages = [];
    active = {};
    const b = base();
    const banlist = baseBanlist();
    for (const kind of KINDS) {
      const folder = path.join(layersDir, kind);
      const file = path.join(folder, 'layer.json');
      if (!fs.existsSync(file)) continue;
      let layer = null;
      try { layer = readJSON(file); } catch { /* reported below */ }
      const problem = layerProblem(layer, kind, folder);
      if (problem) {
        messages.push({ kind, tone: 'bad', text: etx('{label} : mise à jour ignorée ({problem}).', { label: etx(LABEL[kind]), problem }) });
        continue;
      }
      if (outdated(kind, layer, b, banlist)) {
        fs.rmSync(folder, { recursive: true, force: true });
        messages.push({ kind, tone: 'info', text: etx('{label} : la mise à jour du {date} est déjà dans cette version de l’appli, elle a été retirée.', { label: etx(LABEL[kind]), date: layer.createdAt.slice(0, 10) }) });
        continue;
      }
      active[kind] = layer;
    }
    fs.rmSync(activeDir, { recursive: true, force: true });
    // Without cards in the base, the served catalog is always written here (dist/card-hashes.json does not exist).
    if (active.cartes || active.traductions || !b.cards.length) {
      fs.mkdirSync(activeDir, { recursive: true });
      fs.writeFileSync(path.join(activeDir, 'card-hashes.json'), JSON.stringify(applyErrata(mergeCatalog(b, active), getErrata())));
    }
    if (active.bannies) {
      fs.mkdirSync(activeDir, { recursive: true });
      fs.writeFileSync(path.join(activeDir, 'banlist.json'), JSON.stringify(active.bannies.data));
    }
    return status();
  }

  /**
   * File served instead of the base one for `rel` (« /card-hashes.json »,
   * « /banlist.json », « /cards/<id>.webp », « /cards/thumbs/<id>.webp »), or null.
   */
  function resolve(rel) {
    if (rel === '/card-hashes.json' || rel === '/banlist.json') {
      const f = path.join(activeDir, rel.slice(1));
      return fs.existsSync(f) ? f : null;
    }
    const m = /^\/(cards\/(?:thumbs\/)?[a-z0-9][a-z0-9-]{1,60}\.webp)$/.exec(rel);
    if (m && active.cartes?.files?.[m[1]]) return path.join(layersDir, 'cartes', m[1]);
    return null;
  }

  /**
   * Installs a layer (after the user's « Installer »): written in a temporary
   * folder, checked, then put in place. The previous layer of that kind is kept
   * (« Restaurer la liste précédente »). `files`: { 'cards/<id>.webp': Buffer }.
   */
  function install(kind, layer, files = {}) {
    if (!KINDS.includes(kind)) throw new Error('Type de contenu inconnu.');
    const before = mergedNow();
    const tmp = path.join(layersDir, `.${kind}-${Date.now()}`);
    fs.mkdirSync(tmp, { recursive: true });
    try {
      const listed = {};
      for (const [rel, buf] of Object.entries(files)) {
        if (!FILE_PATH.test(rel)) throw new Error(etx('Nom de fichier refusé ({rel}).', { rel }));
        fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
        fs.writeFileSync(path.join(tmp, rel), buf);
        listed[rel] = sha256(buf);
      }
      const full = { ...layer, kind, format: 1, files: { ...listed } };
      fs.writeFileSync(path.join(tmp, 'layer.json'), JSON.stringify(full));
      const problem = layerProblem(full, kind, tmp);
      if (problem) throw new Error(etx('Mise à jour refusée : {problem}.', { problem }));
      const target = path.join(layersDir, kind);
      const previous = path.join(layersDir, `${kind}.precedent`);
      fs.rmSync(previous, { recursive: true, force: true });
      if (fs.existsSync(target)) fs.renameSync(target, previous);
      fs.renameSync(tmp, target);
    } catch (err) {
      fs.rmSync(tmp, { recursive: true, force: true });
      throw err;
    }
    rebuild();
    // Errata (lot 7.6): texts changed by this update, written into the served catalog
    if (recordErrata(before)) rebuild();
    return status();
  }

  /**
   * New cards on top of the cards layer already installed (lot 4.2): its
   * cards, corrections and images are kept, the new ones win.
   */
  function installCards(layer, files = {}) {
    const prev = active.cartes;
    if (!prev) return install('cartes', layer, files);
    const d = layer.data;
    const newIds = new Set(d.cards.map(c => c.id));
    const removed = new Set([...(prev.data.removed || []), ...(d.removed || [])]);
    const cards = [...prev.data.cards.filter(c => !newIds.has(c.id) && !removed.has(c.id)), ...d.cards];
    const patches = new Map((prev.data.patches || []).map(p => [p.id, { ...p }]));
    for (const p of d.patches || []) patches.set(p.id, { ...patches.get(p.id), ...p });
    const keep = {};
    for (const rel of Object.keys(prev.files || {})) {
      const id = rel.replace(/^cards\/(thumbs\/)?/, '').replace(/\.webp$/, '');
      if (!files[rel] && cards.some(c => c.id === id)) keep[rel] = fs.readFileSync(path.join(layersDir, 'cartes', rel));
    }
    return install('cartes', {
      ...layer,
      count: cards.length + patches.size,
      data: { cards, patches: [...patches.values()], removed: [...removed] },
    }, { ...keep, ...files });
  }

  /**
   * « Importer un dossier » (first launch, or a friend's USB key): a folder
   * holding card-hashes.json and cards/ (or public/card-hashes.json and
   * public/cards/, like the content backup). Its cards become the cards layer
   * (with their French names and texts), checked like any layer; the cards
   * downloaded since are kept. Refused when made for another AI model or detector.
   */
  function importFolder(folder) {
    const root = [folder, path.join(folder, 'public')].find(r => fs.existsSync(path.join(r, 'card-hashes.json')) && fs.existsSync(path.join(r, 'cards')));
    if (!root) throw new Error(etx('Ce dossier ne contient pas de cartes : il faut card-hashes.json et le dossier cards (ou un dossier public qui les contient).'));
    let catalog;
    try { catalog = readJSON(path.join(root, 'card-hashes.json')); } catch { throw new Error(etx('card-hashes.json est illisible.')); }
    if (!Array.isArray(catalog?.cards) || !catalog.cards.length) throw new Error(etx('card-hashes.json ne contient aucune carte.'));
    const mine = base().embeddings || {};
    const theirs = catalog.embeddings || {};
    if (mine.modelSha256 && theirs.modelSha256 !== mine.modelSha256) throw new Error(etx('Ces cartes ont été préparées pour un autre modèle d’IA : utilisez un dossier fait par cette version de l’appli, ou téléchargez les cartes depuis la galerie.'));
    if (mine.detectorSha256 && canonDetector(theirs.detectorSha256) !== canonDetector(mine.detectorSha256)) throw new Error(etx('Ces cartes ont été préparées pour un autre détecteur : utilisez un dossier fait par cette version de l’appli, ou téléchargez les cartes depuis la galerie.'));
    const cards = catalog.cards.filter(c => CARD_ID.test(c?.id || ''));
    const files = {};
    for (const c of cards) {
      for (const rel of [`cards/${c.id}.webp`, `cards/thumbs/${c.id}.webp`]) {
        const file = path.join(root, rel);
        let size;
        try { size = fs.statSync(file).size; } catch { continue; }
        if (size > 4 * 1024 * 1024) throw new Error(etx('Image trop grosse : {rel}.', { rel }));
        files[rel] = fs.readFileSync(file);
      }
    }
    installCards({
      createdAt: new Date().toISOString(),
      source: { label: 'dossier importé' },
      count: cards.length,
      data: { cards, patches: [], removed: [] },
    }, files);
    return { ...status(), imported: { cards: cards.length, images: Object.keys(files).filter(r => !r.includes('/thumbs/')).length } };
  }

  /** Active layers for a pack (lot 4.5): { kind: { json: Buffer, files: { 'cards/…': Buffer } } }. */
  function exportLayers() {
    const out = {};
    for (const [kind, layer] of Object.entries(active)) {
      const folder = path.join(layersDir, kind);
      const files = {};
      for (const rel of Object.keys(layer.files || {})) files[rel] = fs.readFileSync(path.join(folder, rel));
      out[kind] = { json: fs.readFileSync(path.join(folder, 'layer.json')), files };
    }
    return out;
  }

  /** createdAt of each active layer (a pack older than these is refused). */
  const layerDates = () => Object.fromEntries(Object.entries(active).map(([k, l]) => [k, l.createdAt]));

  /** Layers of a checked pack (pack.cjs readPack): each one installed with the usual checks. */
  function importLayers(layers, kinds) {
    for (const kind of kinds) install(kind, layers[kind].layer, layers[kind].files);
    return status();
  }

  /** Puts back the layer installed before the current one (or the base when there was none). */
  function restorePrevious(kind) {
    const target = path.join(layersDir, kind);
    const previous = path.join(layersDir, `${kind}.precedent`);
    fs.rmSync(target, { recursive: true, force: true });
    if (fs.existsSync(previous)) fs.renameSync(previous, target);
    return rebuild();
  }

  /** « Revenir au contenu d’origine »: every layer removed. */
  function reset() {
    fs.rmSync(layersDir, { recursive: true, force: true });
    return rebuild();
  }

  function status() {
    const b = base();
    const banlist = active.bannies?.data || baseBanlist();
    const merged = active.cartes || active.traductions ? mergeCatalog(b, active) : b;
    const layer = (k) => (active[k] ? { createdAt: active[k].createdAt, source: active[k].source || null, count: active[k].count ?? null } : null);
    return {
      base: { generatedAt: b.generatedAt, cards: b.cards.length },
      cards: merged.cards.length,
      namesFr: merged.cards.filter(c => c.nameFr).length,
      textsFr: merged.cards.filter(c => c.textFr).length,
      errata: Object.keys(getErrata()).length,
      lastSet: merged.cards.at(-1)?.setName || null,
      banlist: banlist ? { updatedAt: banlist.updatedAt, formats: banlist.formats } : null,
      layers: Object.fromEntries(KINDS.map(k => [k, layer(k)])),
      previous: Object.fromEntries(KINDS.map(k => [k, fs.existsSync(path.join(layersDir, `${k}.precedent`))])),
      // « Vérifier chaque semaine » (on by default) and the last check
      lastPack: getState().lastPack || null,
      checks: Object.fromEntries(['cartes', 'traductions'].map(k => { const s = getState()[k] || {}; return [k, { weekly: s.weekly !== false, lastCheck: s.lastCheck || null }]; })),
      messages,
    };
  }

  return { rebuild, resolve, install, installCards, importFolder, restorePrevious, reset, status, getState, setState, exportLayers, importLayers, layerDates };
}

module.exports = { createContent, mergeCatalog, layerProblem, textChanges, applyErrata, KINDS };
