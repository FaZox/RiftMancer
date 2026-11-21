/**
 * RiftMancer — PC app (Electron).
 *
 * The PC is the sync hub: it keeps the collection in SQLite, serves the web
 * app to its own window and runs the local sync server the phone connects to
 * over Wi-Fi. Run with `npm run desktop` (builds the web app first).
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { app, BrowserWindow, ipcMain, shell, dialog, screen } = require('electron');
const { Store } = require('./store.cjs');
const { createServer } = require('./server.cjs');
const { createPrices, copiesValue } = require('./prices.cjs');
const { listBackupsWithCopies, resolveBackup, extraStatus, copyToExtra, validExtraDir } = require('./backups.cjs');
const { startMdns } = require('./mdns.cjs');
const { takeOverOldData } = require('./dataFolder.cjs');
const { etx, setMainLang } = require('./i18n.cjs');
const { createContent } = require('./content.cjs');
const { fetchContent, FETCH_MESSAGE } = require('./contentFetch.cjs');
const { buildPack, readPack, packKeys } = require('./pack.cjs');
// Public key of the content packs (lot 4.5), written by `npm run pack:keygen`; none → every pack refused.
// Public keys of the packs: a list (rotation, revocation), the former single key still read
const PACK_KEYS = (() => { try { return packKeys(require('./packPublicKey.json')); } catch { return []; } })();

// Two installable variants side by side (scripts/desktop-exe.mjs):
//   daily — « RiftMancer », the one used every day;
//   test  — « RiftMancer Test »: own data folder, own port, own
//           pairing, so trying a new version never touches the real collection.
// The variant is written into the packaged package.json (extraMetadata);
// RB_VARIANT=test does the same with `npm run desktop`.
const VARIANT = (process.env.RB_VARIANT || require('../package.json').variant) === 'test' ? 'test' : 'daily';
// Data folder named after the app (%APPDATA%\riftmancer, riftmancer-test): on the first launch the
// folder of « Riftbound Scanner » is copied into it, the old one kept as it was (dataFolder.cjs).
if (!process.env.RIFTBOUND_DATA_DIR) {
  try {
    const data = takeOverOldData(app.getPath('appData'), VARIANT);
    if (data.taken) console.log(`[data] ${data.files} fichiers repris de ${data.from}`);
    app.setPath('userData', data.dir);
  } catch (err) {
    console.error('[data] reprise du dossier impossible :', err);
    app.setPath('userData', path.join(app.getPath('appData'), VARIANT === 'test' ? 'riftmancer-test' : 'riftmancer'));
  }
}

const PORT = VARIANT === 'test' ? 47322 : 47321;
const APP_ORIGIN = `http://127.0.0.1:${PORT}`;

/** Only https links (and plain http) may be handed to the system browser. */
function isWebLink(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
const BACKUP_MIN_INTERVAL = 10 * 60 * 1000; // at most one automatic backup per 10 min

// Silence node:sqlite's "experimental" warning in the console.
process.removeAllListeners('warning');

// Optional data folder override (tests, or a portable install).
if (process.env.RIFTBOUND_DATA_DIR) app.setPath('userData', process.env.RIFTBOUND_DATA_DIR);

let mainWindow = null;
let store = null;
let lastBackup = 0;
let prices = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(start);
}

function pcName() {
  return os.hostname();
}

/** LAN IPv4 addresses, real network adapters first (virtual ones last). */
function lanAddresses() {
  const virtual = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|Loopback|docker|vbox|utun|tailscale|zerotier/i;
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      out.push({ address: a.address, virtual: virtual.test(name) });
    }
  }
  out.sort((a, b) => a.virtual - b.virtual);
  return out.map(a => a.address);
}

function backupsDir() {
  return path.join(app.getPath('userData'), 'backups');
}

function backup(reason) {
  try {
    const file = store.backup(backupsDir());
    lastBackup = Date.now();
    console.log(`[backup] ${reason}: ${file}`);
    // Lot 3.3: a copy in the extra folder (USB key, other disk); missing → said, not blocking.
    const extra = store.getMeta('extraBackupDir', null);
    if (extra && !copyToExtra(file, extra).ok) console.warn('[backup] dossier supplémentaire inaccessible:', extra);
  } catch (err) {
    console.error('[backup] failed:', err);
  }
}

function syncInfo() {
  const { pcId, token } = store.identity();
  const devices = store.getMeta('devices', {});
  return {
    pcId,
    token,
    name: pcName(),
    port: PORT,
    ips: lanAddresses(),
    // The phones' keys stay in the main process.
    devices: Object.entries(devices).map(([id, { key, ...d }]) => ({ id, ...d })),
    backupsDir: backupsDir(),
    extraBackup: extraStatus(store.getMeta('extraBackupDir', null)),
    lanSync: lanEnabled(),
    appVersion: app.getVersion(),
    lastBackup,
    phoneOffer: store.getMeta('phoneOffer', null),
  };
}

/** « Autoriser la synchronisation sur le réseau » (on by default). */
function lanEnabled() {
  return store.getMeta('lanSync', true) !== false;
}

function notify(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

let mdns = null;
let serverApi = null; // { server, openPairing, currentHelloHash, … } (server.cjs)

async function start() {
  store = new Store(path.join(app.getPath('userData'), 'collection.sqlite'));
  if (store.count('copies') > 0) backup('startup');

  ipcMain.on('app:variant', (e) => { e.returnValue = VARIANT; });
  // language chosen in the app (src/lib/i18n.js): dialogs and messages of this process follow it
  ipcMain.on('app:lang', (_e, lang) => setMainLang(lang));
  ipcMain.handle('db:load', (_e, collection) => store.load(collection));
  ipcMain.handle('display:setTextScale', (_e, scale) => {
    textScale = Math.max(0.8, Math.min(1.6, Number(scale) || 1));
    autoZoom = null;
    fitZoomToScreen();
  });
  ipcMain.handle('db:put', (_e, collection, records) => { store.putLocal(collection, records); });
  ipcMain.handle('sync:info', () => syncInfo());
  // New QR code secret: the QR codes already shown or photographed stop
  // working; the phones already paired keep their own key.
  ipcMain.handle('sync:regenerateToken', () => {
    store.regenerateToken();
    return syncInfo();
  });
  // « Dissocier » a phone: its key is deleted, it is refused at once (it must
  // scan the QR code shown on the PC again). The other phones are not affected.
  ipcMain.handle('sync:removeDevice', (_e, id) => {
    const devices = store.getMeta('devices', {});
    delete devices[id];
    store.setMeta('devices', devices);
    return syncInfo();
  });
  // The QR code is shown (Réglages → Synchronisation): pairing accepted for 5 min.
  ipcMain.handle('sync:openPairing', () => serverApi?.openPairing() ?? null);
  ipcMain.handle('sync:setLan', (_e, on) => {
    store.setMeta('lanSync', !!on);
    listen();
    return syncInfo();
  });
  ipcMain.handle('backup:now', () => { backup('manual'); return syncInfo(); });
  ipcMain.handle('backup:open', () => shell.openPath(backupsDir()));
  ipcMain.handle('backup:list', () => listBackupsWithCopies(backupsDir()));
  // « Choisir un dossier… » (lot 3.3): a second copy of every backup, e.g. on a USB key.
  ipcMain.handle('backup:chooseExtra', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: etx('Dossier supplémentaire pour les sauvegardes'),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return syncInfo();
    if (!validExtraDir(r.filePaths[0], backupsDir())) throw new Error('Choisissez un autre dossier que celui des sauvegardes de ce PC.');
    store.setMeta('extraBackupDir', r.filePaths[0]);
    backup('extra-folder'); // a first copy there at once
    return syncInfo();
  });
  ipcMain.handle('backup:clearExtra', () => { store.setMeta('extraBackupDir', null); return syncInfo(); });
  ipcMain.handle('backup:restore', (_e, name) => {
    const file = resolveBackup(backupsDir(), name);
    if (!file) throw new Error('Sauvegarde introuvable');
    backup('before-restore'); // the current state can itself be restored
    const n = store.restoreFrom(file);
    notify('db:changed');
    return n;
  });
  ipcMain.handle('sync:log', () => store.getMeta('syncLog', []));
  // « Envoyer sur le téléphone »: the PC cannot reach the phone by itself (an
  // Android app cannot listen on the network), so it leaves a request the
  // phone shows when it opens: « Le PC vous envoie des données → Recevoir ».
  ipcMain.handle('sync:offer', (_e, on) => { store.setMeta('phoneOffer', on ? Date.now() : null); return syncInfo(); });

  const distDir = path.join(__dirname, '..', 'dist');

  // Content updated from the PC (lot 4.1): layers over the catalog shipped with the app.
  const content = createContent({ dir: path.join(app.getPath('userData'), 'catalogue'), distDir });
  try { content.rebuild(); } catch (err) { console.error('[content] layers not applied:', err); }
  const contentStatus = () => { try { return content.status(); } catch (err) { return { error: err.message }; } };
  const contentChanged = (s) => { notify('content:changed'); return s; };
  ipcMain.handle('content:status', () => contentStatus());
  ipcMain.handle('content:reset', () => contentChanged(content.reset()));
  ipcMain.handle('content:restorePrevious', (_e, kind) => contentChanged(content.restorePrevious(kind)));
  // Lot 4.3 / 4.4: an official page or file, read by the main process only (contentFetch.cjs: allowed addresses).
  ipcMain.handle('content:fetch', async (_e, url) => {
    const r = await fetchContent(url, { version: app.getVersion() });
    return r.ok ? { ok: true, text: r.text, status: r.status } : { ok: false, reason: r.reason, status: r.status, message: FETCH_MESSAGE[r.reason] };
  });
  // Weekly check (lot 4.2 / 4.3): at most once a week, at startup, if on (default). Conditional
  // requests (ETag / Last-Modified) once the user has the content; a failure is not retried
  // until next week, and reminded at most once a month. Nothing installed here.
  const WEEK = 7 * 24 * 3600e3, MONTH = 30 * 24 * 3600e3;
  ipcMain.handle('content:weeklyCheck', async (_e, kind, urls) => {
    const state = content.getState();
    const k = state[kind] || {};
    if (k.weekly === false) return { skipped: 'off' };
    if (k.lastCheck && Date.now() - k.lastCheck < WEEK) return { skipped: 'recent' };
    k.lastCheck = Date.now();
    const texts = [], validators = {};
    let notModified = 0;
    for (const url of urls) {
      const v = k.validators?.[url] || {};
      const r = await fetchContent(url, { version: app.getVersion(), etag: v.etag, lastModified: v.lastModified });
      if (!r.ok) {
        const remind = !k.lastReminder || Date.now() - k.lastReminder > MONTH;
        if (remind) k.lastReminder = Date.now();
        content.setState({ ...state, [kind]: k });
        return { failed: true, reason: r.reason, message: FETCH_MESSAGE[r.reason], remind };
      }
      if (r.notModified) { notModified++; continue; }
      texts.push(r.text);
      validators[url] = { etag: r.etag, lastModified: r.lastModified };
    }
    content.setState({ ...state, [kind]: k });
    if (notModified === urls.length) return { notModified: true };
    if (notModified) {
      // One file changed, the other not: download both again next time (no partial update).
      return { failed: true, reason: 'partial', remind: false };
    }
    return { ok: true, texts, validators };
  });
  ipcMain.handle('content:saveValidators', (_e, kind, validators) => {
    const state = content.getState();
    content.setState({ ...state, [kind]: { ...state[kind], validators } });
  });
  ipcMain.handle('content:setWeekly', (_e, kind, on) => {
    const state = content.getState();
    content.setState({ ...state, [kind]: { ...state[kind], weekly: !!on } });
    return contentStatus();
  });
  // New cards (lot 4.2): the official images, downloaded by the main process only.
  ipcMain.handle('content:fetchImage', async (_e, url) => {
    const r = await fetchContent(url, { version: app.getVersion(), binary: true });
    if (!r.ok) return { ok: false, reason: r.reason, message: FETCH_MESSAGE[r.reason] };
    if (r.bytes.length > 8 * 1024 * 1024) return { ok: false, reason: 'too-big', message: FETCH_MESSAGE['too-big'] };
    return { ok: true, bytes: new Uint8Array(r.bytes) };
  });
  // New cards: data, corrections and images made on screen after « Installer » (checked again in content.cjs).
  ipcMain.handle('content:installCards', (_e, layer, files) => {
    const buffers = {};
    let total = 0;
    for (const [rel, bytes] of Object.entries(files || {})) {
      const b = Buffer.from(bytes);
      if (b.length > 4 * 1024 * 1024) throw new Error(`Image trop grosse : ${rel}.`);
      total += b.length;
      buffers[rel] = b;
    }
    if (total > 400 * 1024 * 1024) throw new Error(etx('Mise à jour trop grosse : refusée.'));
    return contentChanged(content.installCards(layer, buffers));
  });
  // Content packs (lot 4.5): export the active layers; import a signed pack after a summary.
  const catalogInUse = () => JSON.parse(fs.readFileSync(content.resolve('/card-hashes.json') || path.join(distDir, 'card-hashes.json'), 'utf8'));
  const modelOf = () => { const e = catalogInUse().embeddings || {}; return { modelSha256: e.modelSha256 || null, detectorSha256: e.detectorSha256 || null }; };
  ipcMain.handle('pack:export', async () => {
    const buf = buildPack({ layers: content.exportLayers(), model: modelOf(), appVersion: app.getVersion() });
    const r = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter mon contenu', defaultPath: `contenu-${new Date().toISOString().slice(0, 10)}.rbpack`,
      filters: [{ name: 'Pack de contenu Riftbound', extensions: ['rbpack'] }],
    });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, buf);
    return { file: path.basename(r.filePath), size: buf.length };
  });
  let pendingPack = null;
  ipcMain.handle('pack:open', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { title: 'Importer un pack', properties: ['openFile'], filters: [{ name: 'Pack de contenu Riftbound', extensions: ['rbpack'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const file = r.filePaths[0];
    if (fs.statSync(file).size > 600 * 1024 * 1024) throw new Error(etx('Pack refusé : fichier trop gros.'));
    const pack = readPack(fs.readFileSync(file), { publicKeys: PACK_KEYS, current: { model: modelOf(), layers: content.layerDates() } });
    pendingPack = { ...pack, name: path.basename(file) };
    return {
      name: pendingPack.name, createdAt: pack.manifest.createdAt, appVersion: pack.manifest.appVersion,
      layers: pack.manifest.layers, newer: pack.newer, key: pack.signedBy,
    };
  });
  ipcMain.handle('pack:install', () => {
    if (!pendingPack) throw new Error(etx('Aucun pack à installer.'));
    const p = pendingPack;
    pendingPack = null;
    content.importLayers(p.layers, p.newer);
    content.setState({ ...content.getState(), lastPack: { name: p.name, createdAt: p.manifest.createdAt, at: Date.now(), signed: true } });
    return contentChanged(content.status());
  });
  ipcMain.handle('pack:cancel', () => { pendingPack = null; });
  // Translations and banned cards: the layer built on screen after the user's « Installer » (checked again here).
  ipcMain.handle('content:install', (_e, kind, layer) => {
    if (kind !== 'bannies' && kind !== 'traductions') throw new Error(etx('Type de contenu refusé.'));
    return contentChanged(content.install(kind, layer));
  });

  // Cardmarket prices: refreshed at startup and every few hours (at most daily
  // download), plus a daily snapshot of the collection value for the history.
  const recordValue = () => {
    const p = prices.get();
    if (!p) return;
    const copies = store.load('copies');
    const day = new Date().toISOString().slice(0, 10);
    const history = store.getMeta('valueHistory', []).filter(h => h.d !== day);
    // One value per reference price (Réglages → Prix de référence)
    history.push({ d: day, v: copiesValue(copies, p), v7: copiesValue(copies, p, 'avg7'), vl: copiesValue(copies, p, 'low'), n: copies.length });
    store.setMeta('valueHistory', history.slice(-730));
  };
  const pricePayload = () => ({ prices: prices.get(), history: store.getMeta('valueHistory', []) });
  prices = createPrices({
    userData: app.getPath('userData'),
    distDir,
    catalogFile: () => content.resolve('/card-hashes.json'),
    onUpdated: () => { recordValue(); notify('prices:changed'); },
  });
  ipcMain.handle('prices:get', () => pricePayload());
  ipcMain.handle('prices:refresh', async () => { await prices.refresh(true); return pricePayload(); });
  prices.refresh().then(() => { recordValue(); notify('prices:changed'); });
  setInterval(() => prices.refresh(), 3 * 60 * 60 * 1000);
  serverApi = createServer({
    store,
    distDir,
    getName: pcName,
    getPrices: () => pricePayload(),
    content,
    onSynced: ({ deviceId, mode, changed, received, sent, conflicts = [] }) => {
      if (mode === 'pair' || mode === 'unpair') { notify('sync:devices'); return; } // list only, not a sync
      console.log(`[sync] ${deviceId}: received ${received}, applied ${changed}, sent ${sent}`);
      const device = store.getMeta('devices', {})[deviceId]?.name || etx('Téléphone');
      const log = store.getMeta('syncLog', []);
      // Lot 3.4: records modified on both sides are listed (the most recent was kept).
      log.unshift({ at: Date.now(), device, mode, received, changed, sent, conflictCount: conflicts.length, conflicts: conflicts.slice(0, 50) });
      store.setMeta('syncLog', log.slice(0, 50));
      if (changed > 0) {
        notify('db:changed');
        if (Date.now() - lastBackup > BACKUP_MIN_INTERVAL) backup('sync');
      }
      notify('sync:devices');
    },
  });
  const { server } = serverApi;

  server.on('error', (err) => {
    dialog.showErrorBox(
      'RiftMancer',
      err.code === 'EADDRINUSE'
        ? etx('Le port {port} est déjà utilisé. L’application est peut-être déjà ouverte (ou l’ancienne « Riftbound Scanner » : fermez-la).', { port: PORT })
        : etx('Impossible de démarrer le serveur de synchronisation : {message}', { message: err.message }),
    );
    app.quit();
  });

  // Network off → the server only answers this PC (127.0.0.1) and the PC is
  // no longer announced (mDNS). Changing the setting re-listens at once.
  let windowCreated = false;
  function listen() {
    const host = lanEnabled() ? '0.0.0.0' : '127.0.0.1';
    const go = () => server.listen(PORT, host, () => {
      console.log(`[server] http://127.0.0.1:${PORT}` + (host === '0.0.0.0' ? `  (LAN: ${lanAddresses().join(', ')})` : '  (réseau désactivé)'));
      if (!windowCreated) { windowCreated = true; createWindow(); }
    });
    if (server.listening) {
      server.close(go);
      server.closeAllConnections();
    } else go();
    if (lanEnabled() && !mdns) {
      mdns = startMdns(() => ({
        hash: serverApi.currentHelloHash(), port: PORT, addresses: lanAddresses(),
      }), (...a) => console.warn(...a));
    } else if (!lanEnabled() && mdns) {
      mdns.stop();
      mdns = null;
    }
  }
  listen();
  // The PC fingerprint changes at midnight (UTC): announce the new one.
  let lastHash = serverApi.currentHelloHash();
  setInterval(() => {
    const h = serverApi.currentHelloHash();
    if (h !== lastHash) { lastHash = h; mdns?.announce(); }
  }, 60 * 1000);

  app.on('before-quit', () => {
    mdns?.stop();
    if (store.count('copies') > 0 && Date.now() - lastBackup > BACKUP_MIN_INTERVAL) backup('exit');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 380,
    show: false,
    backgroundColor: '#070d18', // same as the loading screen (B.6.13 rule 7)
    autoHideMenuBar: true,
    title: VARIANT === 'test' ? 'RiftMancer — TEST' : 'RiftMancer',
    icon: path.join(__dirname, '..', 'dist', 'icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Lot 2.1: no developer tools in the installed everyday app (Ctrl+Maj+I
      // does nothing); kept from the sources (npm run desktop) and in the test app.
      devTools: !app.isPackaged || VARIANT === 'test',
    },
  });
  // Links (Cardmarket…) open in the default browser, never inside the app,
  // and only web links: file:, smb:, ms-… and other schemes are refused.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebLink(url)) shell.openExternal(url);
    else console.warn('[window] lien refusé:', url);
    return { action: 'deny' };
  });
  // The window never leaves the app's own pages.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_ORIGIN + '/')) {
      e.preventDefault();
      if (isWebLink(url)) shell.openExternal(url);
    }
  });
  mainWindow.loadURL(APP_ORIGIN + '/');
  mainWindow.on('closed', () => { mainWindow = null; });

  // Opens full screen (maximised), at a scale that suits the screen.
  mainWindow.once('ready-to-show', () => { mainWindow.maximize(); mainWindow.show(); });
  mainWindow.webContents.on('did-finish-load', fitZoomToScreen);
  mainWindow.on('moved', fitZoomToScreen); // dragged to another screen
}

/**
 * Interface scale from the screen width (in Windows' own pixels, so the
 * Windows « Échelle » setting is already taken into account):
 *   up to 2200 px (1080p, laptops)  → 100 %
 *   2200–2999 px (2K / 1440p at 100 %) → 125 %
 *   3000 px and more (4K at 100 %)  → 150 %
 * Ctrl + molette / Ctrl + / Ctrl − still let the user adjust it.
 */
let autoZoom = null;
let textScale = 1; // Réglages → Affichage → Taille du texte (B.4)
function fitZoomToScreen() {
  if (!mainWindow) return;
  const { width } = screen.getDisplayMatching(mainWindow.getBounds()).workAreaSize;
  const zoom = (width >= 3000 ? 1.5 : width >= 2200 ? 1.25 : 1) * textScale;
  if (zoom === autoZoom) return;
  autoZoom = zoom;
  mainWindow.webContents.setZoomFactor(zoom);
}

app.on('window-all-closed', () => app.quit());
