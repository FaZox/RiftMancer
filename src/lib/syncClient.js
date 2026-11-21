/**
 * Phone ↔ PC sync (phone side). Local-first: the phone always works on its
 * own data; changes are exchanged with the PC app (same network) when the
 * user asks for it.
 *
 *   - Pairing: scan the QR code shown by the PC (address, port, pairing
 *     secret). The PC answers with this phone's own key (protocol v3): the
 *     stored pairing is { pcId, name, port, hosts, lastHost, deviceId,
 *     deviceKey, pcSecret } — the QR code secret is not kept.
 *   - Sync: push local changes (records flagged dirty), pull what changed on
 *     the PC since the last sync (`since` = PC sequence number). Conflicts:
 *     the most recent change wins.
 *   - When: only when the user taps « Synchroniser maintenant » (no
 *     automatic sync, by choice).
 *   - Protocol v2 (syncProtocol.js): signed requests, encrypted bodies; the
 *     pairing secret never travels on the network.
 *   - If the PC changed IP address: discovery on the local network (mDNS,
 *     `_riftbound._tcp`) when the native plugin is there; otherwise the user
 *     can start « Rechercher le PC sur le réseau » (slow /24 scan, manual only).
 *   - After the data: new card catalog (new sets) and missing images.
 *
 * Not used by the PC app itself (it is the hub, see electron/).
 */

import {
  SYNCED_COLLECTIONS, isDesktop, getMeta, setMeta, getDirty, markClean,
  markAllDirty, applyRemote, setLocalChangeHandler,
} from './collectionDB.js';
import { isNative, saveCatalog, downloadMissingImages } from './nativeAssets.js';
import { startRecognition } from './recognition.js';
import { getMatcher } from './cardMatcher.js';
import { savePrices, getPricesState } from './prices.js';
import { APP_VERSION } from './appVersion.js';
import { phoneCompat } from './versionCompat.js';
import { PROTO, deriveKeys, helloHashes, secureRequest, catalogHash, utcDay } from './syncProtocol.js';
import { discoverPcs } from './pcDiscovery.js';
import { setBanlist } from './banlist.js';import { tx } from './i18n.js';


const HELLO_TIMEOUT = 2500;
const SCAN_CONCURRENCY = 8;

// ─── Observable state for the UI ─────────────────────────────────────────
let state = {
  paired: false,
  pcName: null,
  status: 'idle', // idle | syncing | ok | offline | error
  lastSync: null,
  lastError: null,
  images: null, // { done, total, failed } while downloading
  fullImages: true,
  pending: 0, // local changes not sent to the PC yet
  pendingSince: null, // date of the oldest of them (rappel de synchro, lot 3.2)
  pcVersion: null, // { version, at } seen at the last sync (lot 4.6)
  pcProto: null, // protocol of a PC that answered with another one (sync impossible)
  pcOffer: null, // the PC asked to send its data (« Envoyer sur le téléphone »)
  searching: null, // { done, total } during « Rechercher le PC sur le réseau »
  clockSkew: 0, // PC time − phone time (ms) seen at the last sync
};
const subscribers = new Set();
function setState(patch) {
  state = { ...state, ...patch };
  for (const fn of subscribers) fn(state);
}
export function getSyncState() { return state; }
export function subscribeSync(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export const syncAvailable = !isDesktop;

// ─── Helpers ─────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, opts = {}, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Keys of this phone + fingerprints of its PC (computed once per key and per day).
let keyCache = { id: null, keys: null, hashes: null };
async function keysFor(pairing) {
  const id = `${pairing.deviceKey}|${pairing.pcSecret}|${utcDay()}`;
  if (keyCache.id !== id) {
    keyCache = {
      id,
      keys: await deriveKeys(pairing.deviceKey),
      hashes: await helloHashes(await deriveKeys(pairing.pcSecret)),
    };
  }
  return keyCache;
}

/** Is our PC answering at host:port (its fingerprint of yesterday, today or tomorrow)? */
async function hello(host, port, hashes) {
  return (await helloCheck(host, port, hashes)).ok ? true : null;
}

/**
 * Same, with the reason when it fails (shown when pairing fails):
 *   'unreachable' no answer · 'other' not this app · 'old' other version of
 *   the app · 'key' another PC. `hashes` null: any PC of this app (pairing:
 *   the PC then proves it holds the QR code secret).
 */
async function helloCheck(host, port, hashes) {
  let j;
  try {
    const r = await fetchWithTimeout(`http://${host}:${port}/api/hello`, {}, HELLO_TIMEOUT);
    if (!r.ok) return { ok: false, why: 'other' };
    j = await r.json();
  } catch {
    return { ok: false, why: 'unreachable' };
  }
  if (j.app !== 'riftbound-scanner') return { ok: false, why: 'other' };
  if (j.proto !== PROTO) {
    lastProtoMismatch = Number(j.proto) || 0; // lot 4.6: which side to update
    return { ok: false, why: 'old' };
  }
  if (hashes && !hashes.has(j.pcIdHash)) return { ok: false, why: 'key' };
  return { ok: true };
}

const request = (base, path, keys, opts) => secureRequest((url, o) => fetchWithTimeout(url, o, 60000), base, path, keys, opts);

const UNPAIRED_BY_PC = tx('Le PC a dissocié ce téléphone. Scannez à nouveau son QR code pour synchroniser.');

function deviceName() {
  const ua = navigator.userAgent;
  const m = ua.match(/Android [\d.]+; ([^;)]+)/);
  if (m) return m[1].replace(/ Build.*/, '').trim() || 'Android';
  return /Android/.test(ua) ? tx('Android') : tx('Navigateur');
}

/** Parse the pairing QR code / text shown by the PC app. */
export function parsePairingCode(text) {
  let j;
  try { j = JSON.parse(String(text).trim()); } catch { return null; }
  if (j?.t !== 'riftbound-pair' || !j.id || !j.k || !j.p || !Array.isArray(j.h)) return null;
  return { pcId: j.id, name: j.n || 'PC', port: j.p, hosts: j.h, token: j.k };
}

// ─── Finding the PC ──────────────────────────────────────────────────────
async function findPc(pairing) {
  const { hashes } = await keysFor(pairing);
  const tried = new Set();
  const order = [pairing.lastHost, ...pairing.hosts].filter(Boolean);
  for (const host of order) {
    if (tried.has(host)) continue;
    tried.add(host);
    if (await hello(host, pairing.port, hashes)) return host;
  }
  // The PC may have a new IP address: ask the network (mDNS), which only
  // returns PCs announcing our fingerprint. No address scan here.
  for (const svc of await discoverPcs(hashes)) {
    if (tried.has(svc.host)) continue;
    tried.add(svc.host);
    if (await hello(svc.host, svc.port || pairing.port, hashes)) return svc.host;
  }
  return null;
}

/**
 * « Rechercher le PC sur le réseau » — manual fallback when the PC changed
 * address and mDNS found nothing: tries the addresses of the known /24
 * networks, a few at a time. Returns true when the PC was found.
 */
export async function searchPcOnNetwork() {
  const pairing = await getMeta('pairing');
  if (!pairing) return false;
  const { hashes } = await keysFor(pairing);
  const known = [pairing.lastHost, ...pairing.hosts].filter(Boolean);
  const prefixes = [...new Set(known.map(h => h.split('.').slice(0, 3).join('.')))];
  const candidates = [];
  for (const prefix of prefixes) for (let i = 1; i < 255; i++) candidates.push(`${prefix}.${i}`);
  let found = null;
  let next = 0;
  let done = 0;
  setState({ searching: { done: 0, total: candidates.length } });
  async function worker() {
    while (!found && next < candidates.length) {
      const h = candidates[next++];
      if (await hello(h, pairing.port, hashes)) found = h;
      done++;
      if (done % 8 === 0) setState({ searching: { done, total: candidates.length } });
    }
  }
  try {
    await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, worker));
  } finally {
    setState({ searching: null });
  }
  if (found) {
    await setMeta('pairing', { ...pairing, lastHost: found });
    setState({ status: 'idle', lastError: null });
  }
  return !!found;
}

// ─── Sync ────────────────────────────────────────────────────────────────
let running = null;

/** Run a sync now (coalesces concurrent requests). */
/**
 * Manual sync, in the direction the user chose:
 *   'both' — send the phone's changes and receive the PC's;
 *   'push' — « Envoyer sur le PC » (phone → PC only);
 *   'pull' — « Recevoir du PC » (PC → phone only).
 */
export function syncNow(mode = 'both') {
  if (running) return running;
  running = doSync(mode)
    .catch(err => {
      console.warn('[sync]', err);
      setState({ status: 'error', lastError: String(err.message || err) });
    })
    .finally(() => {
      running = null;
    });
  return running;
}

let lastProtoMismatch = null;

async function doSync(mode = 'both') {
  const pairing = await getMeta('pairing');
  if (!pairing) { setState({ paired: false, status: 'idle' }); return; }
  setState({ paired: true, pcName: pairing.name, status: 'syncing', lastError: null });

  lastProtoMismatch = null;
  const host = await findPc(pairing);
  if (!host) {
    if (lastProtoMismatch != null) {
      const c = phoneCompat({ myProto: PROTO, pcProto: lastProtoMismatch, myVersion: APP_VERSION, pcVersion: state.pcVersion?.version });
      setState({ status: 'error', lastError: c?.text || tx('Versions incompatibles.'), pcProto: lastProtoMismatch });
      return;
    }
    setState({ status: 'offline' });
    return;
  }
  if (host !== pairing.lastHost) await setMeta('pairing', { ...pairing, lastHost: host });
  const base = `http://${host}:${pairing.port}`;
  const { keys } = await keysFor(pairing);

  const sinceKey = `since:${pairing.pcId}`;
  let catalogVersion = null;
  let banlistVersion = null;
  let pricesUpdatedAt = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const since = (await getMeta(sinceKey)) || 0;
    const push = {};
    for (const col of SYNCED_COLLECTIONS) push[col] = mode === 'pull' ? [] : await getDirty(col);

    let res;
    try {
      res = await request(base, '/api/sync', keys, {
        method: 'POST',
        deviceId: pairing.deviceId,
        body: { deviceName: deviceName(), since, push, mode, clientNow: Date.now(), appVersion: APP_VERSION },
      });
    } catch (err) {
      if (err?.code === 'device') {
        // The PC unpaired this phone (« Dissocier » on the PC): its key is gone.
        await unpair({ notifyPc: false, reason: UNPAIRED_BY_PC });
        return;
      }
      throw err;
    }
    if (res.reset) {
      // The PC database was replaced: send it everything again.
      await setMeta(sinceKey, 0);
      for (const col of SYNCED_COLLECTIONS) await markAllDirty(col);
      continue;
    }
    // Only collections the PC knows were stored there (an older PC app may
    // not handle e.g. the wish list yet: keep those changes pending).
    const accepted = res.collections || ['copies'];
    const pcKnowsModes = !!res.mode; // older PC app: always both ways
    const received = mode !== 'push' || !pcKnowsModes;
    for (const col of SYNCED_COLLECTIONS) {
      if (received) await applyRemote(col, res.pull?.[col] || [], res.clockSkew || 0);
      if (accepted.includes(col) && push[col].length) await markClean(col, push[col]);
    }
    if (received) await setMeta(sinceKey, res.seq);
    // Sync history (phone): what was sent / received, per collection.
    const counts = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, v.length]).filter(([, n]) => n > 0));
    const log = (await getMeta('syncLog')) || [];
    log.unshift({ at: Date.now(), pc: pairing.name || 'PC', mode, sent: counts(push), received: counts(res.pull), conflicts: res.conflicts || [] });
    await setMeta('syncLog', log.slice(0, 50));
    setState({ clockSkew: res.clockSkew || 0, pcProto: null });
    if (res.appVersion) {
      const pcVersion = { version: String(res.appVersion).slice(0, 30), at: Date.now() };
      await setMeta('pcVersion', pcVersion);
      setState({ pcVersion });
    }
    catalogVersion = res.catalogVersion;
    banlistVersion = res.banlistVersion || null;
    pricesUpdatedAt = res.pricesUpdatedAt;
    break;
  }

  if (mode === 'push') {
    setState({ status: 'ok', lastSync: Date.now() });
    refreshPending();
    await setMeta('lastSync', Date.now());
    return;
  }
  setState({ pcOffer: null });

  // Cardmarket prices (downloaded by the PC): fetch when they changed.
  if (pricesUpdatedAt && pricesUpdatedAt !== getPricesState().prices?.updatedAt) {
    try {
      await savePrices(await request(base, '/api/prices', keys, { deviceId: pairing.deviceId }));
    } catch (err) {
      console.warn('[sync] prices not updated:', err);
    }
  }

  setState({ status: 'ok', lastSync: Date.now() });
  refreshPending();
  await setMeta('lastSync', Date.now());

  if (isNative) {
    await updateCatalog(base, catalogVersion).catch(err => console.warn("[sync] catalog not updated:", err));
    await updateBanlist(base, banlistVersion).catch(err => console.warn('[sync] banlist not updated:', err));
    startImageDownload(base);
  }
}

/** Banned / restricted cards: the PC's list when it changed (checked by its hash). */
async function updateBanlist(base, version) {
  if (!version || version === await getMeta('banlistVersion')) return;
  const r = await fetchWithTimeout(`${base}/banlist.json`, {}, 20000);
  if (!r.ok) return;
  const text = await r.text();
  if (await catalogHash(text) !== version) throw new Error(tx('Liste des cartes bannies altérée : ignorée.'));
  const list = JSON.parse(text);
  await setMeta('banlist', list);
  await setMeta('banlistVersion', version);
  setBanlist(list);
}

/** New sets: download the PC's card catalog when it differs from ours. */
async function updateCatalog(base, version) {
  if (!version || version === await getMeta('catalogVersion')) return;
  const r = await fetchWithTimeout(`${base}/card-hashes.json`, {}, 60000);
  if (!r.ok) return;
  const text = await r.text();
  // The catalog travels in clear (public data): check it is exactly the one
  // the PC announced in its (authenticated) answer.
  if (await catalogHash(text) !== version) throw new Error(tx('Catalogue reçu altéré : ignoré.'));
  JSON.parse(text); // validate before saving
  await saveCatalog(text);
  await setMeta('catalogVersion', version);
  await setMeta('catalogReceivedAt', Date.now()); // Réglages → Contenu : « Reçu du PC le … »
  await getMatcher().initialize();
  startRecognition(); // the AI engine follows the new catalog's signatures
  console.log('[sync] Card catalog updated from PC');
}

let imagesRunning = false;
let stopImages = false;

async function startImageDownload(base) {
  if (imagesRunning) return;
  imagesRunning = true;
  stopImages = false;
  try {
    const matcher = getMatcher();
    const ids = matcher.cards.map(c => c.id);
    const bundled = await bundledCardIds();
    const res = await downloadMissingImages(base, ids, bundled, {
      full: state.fullImages,
      shouldStop: () => stopImages,
      onProgress: (p) => setState({ images: p.total > 0 && p.done + p.failed < p.total ? p : null }),
    });
    setState({ images: null });
    if (res.done > 0) console.log(`[sync] ${res.done} images downloaded (${res.failed} failed)`);
  } finally {
    imagesRunning = false;
  }
}

let bundledIdsCache = null;
/** Card ids of the catalog shipped with the app (their thumbnails are bundled). */
async function bundledCardIds() {
  if (bundledIdsCache) return bundledIdsCache;
  try {
    const r = await fetch('/card-hashes.json');
    const j = await r.json();
    bundledIdsCache = new Set(j.cards.map(c => c.id));
  } catch {
    bundledIdsCache = new Set();
  }
  return bundledIdsCache;
}

// ─── Pairing ─────────────────────────────────────────────────────────────
/** Pair with the PC described by the QR code text. Throws a French message on failure. */
export async function pair(code) {
  const p = parsePairingCode(code);
  if (!p) throw new Error(tx('Ce QR code n’est pas un code d’appairage RiftMancer.'));
  let host = null;
  const why = new Set();
  for (const h of p.hosts) {
    const c = await helloCheck(h, p.port, null);
    if (c.ok) { host = h; break; }
    why.add(c.why);
  }
  if (!host) {
    if (why.has('old')) throw new Error(tx('Le PC répond mais son application n’est pas de la même version : installez la même version sur le PC et sur le téléphone.'));
    throw new Error(tx('PC introuvable à {join}. Vérifiez que l’application PC est ouverte, que la synchronisation réseau y est autorisée, que les deux appareils sont sur le même Wi-Fi et que le pare-feu Windows autorise l’application (réseaux privés).', { join: p.hosts.map(h => `${h}:${p.port}`).join(', ') }));
  }
  // The PC proves it holds the QR code secret (its answer is encrypted with
  // it) and gives this phone its own key.
  let res;
  try {
    res = await request(`http://${host}:${p.port}`, '/api/pair', await deriveKeys(p.token), { method: 'POST', body: { deviceName: deviceName() } });
  } catch (err) {
    if (err?.status === 401) throw new Error(tx('Le PC a refusé ce QR code (clé régénérée ?) : scannez le QR code affiché en ce moment sur le PC.'));
    throw err; // 403: QR code not shown on the PC any more (message from syncProtocol)
  }
  const previous = await getMeta('pairing');
  await setMeta('pairing', {
    pcId: res.pcId, name: res.name || p.name, port: p.port, hosts: p.hosts, lastHost: host,
    deviceId: res.deviceId, deviceKey: res.deviceKey, pcSecret: res.pcSecret,
  });
  if (!previous || previous.pcId !== res.pcId) {
    // New PC: send it the whole local collection.
    await setMeta(`since:${res.pcId}`, 0);
    for (const col of SYNCED_COLLECTIONS) await markAllDirty(col);
  }
  setState({ paired: true, pcName: res.name || p.name, lastError: null });
  refreshPending();
}

export async function unpair({ notifyPc = true, reason = null } = {}) {
  stopImages = true;
  const pairing = await getMeta('pairing');
  // Best effort: the PC removes this phone from its list.
  if (notifyPc && pairing?.deviceKey) {
    try {
      const { keys } = await keysFor(pairing);
      const host = pairing.lastHost || pairing.hosts?.[0];
      if (host) {
        await secureRequest((url, o) => fetchWithTimeout(url, o, HELLO_TIMEOUT), `http://${host}:${pairing.port}`, '/api/unpair', keys,
          { method: 'POST', deviceId: pairing.deviceId, body: {} });
      }
    } catch { /* PC not reachable: it keeps the phone in its list */ }
  }
  await setMeta('pairing', null);
  setState({ paired: false, pcName: null, status: 'idle', lastError: reason, images: null });
}

export async function setFullImages(enabled) {
  await setMeta('fullImages', enabled);
  setState({ fullImages: enabled });
  if (!enabled) stopImages = true;
}

// ─── Startup (manual sync only) ───────────────────────────────────────────
// Sync never runs on its own: the user decides when (« Synchroniser
// maintenant »), so work in progress on the PC is never merged unexpectedly.
let started = false;

async function refreshPending() {
  let n = 0;
  let since = null;
  for (const col of SYNCED_COLLECTIONS) {
    const dirty = await getDirty(col);
    n += dirty.length;
    for (const r of dirty) if (r.updatedAt && (since == null || r.updatedAt < since)) since = r.updatedAt;
  }
  setState({ pending: n, pendingSince: since });
}

export async function initSync() {
  if (started || !syncAvailable) return;
  started = true;
  let pairing = await getMeta('pairing');
  let migrationMessage = null;
  if (pairing && !pairing.deviceKey) {
    // Paired with an older version (one shared key): pair again (protocol v3).
    await setMeta('pairing', null);
    pairing = null;
    migrationMessage = tx('Nouvelle version de la synchronisation : scannez à nouveau le QR code du PC (Réglages → Synchronisation).');
  }
  const fullImages = await getMeta('fullImages');
  const banlist = await getMeta('banlist');
  if (banlist) setBanlist(banlist);
  setState({
    paired: !!pairing,
    pcName: pairing?.name || null,
    lastSync: (await getMeta('lastSync')) || null,
    pcVersion: (await getMeta('pcVersion')) || null,
    fullImages: fullImages !== false,
    lastError: migrationMessage,
  });
  let timer = null;
  setLocalChangeHandler(() => {
    clearTimeout(timer);
    timer = setTimeout(refreshPending, 300);
  });
  refreshPending();
  if (pairing) checkPcOffer();
}

/**
 * Does the PC want to send its data (« Envoyer sur le téléphone » on the PC)?
 * Only asks the PC (last known address, short timeout) — never syncs: the
 * phone then shows « Recevoir du PC » and the user decides.
 */
export async function checkPcOffer() {
  try {
    const pairing = await getMeta('pairing');
    if (!pairing) return;
    const host = pairing.lastHost || pairing.hosts?.[0];
    if (!host) return;
    const { keys, hashes } = await keysFor(pairing);
    if (!await hello(host, pairing.port, hashes)) return;
    const j = await secureRequest((url, o) => fetchWithTimeout(url, o, HELLO_TIMEOUT * 2), `http://${host}:${pairing.port}`, '/api/status', keys, { deviceId: pairing.deviceId });
    setState({ pcOffer: j?.offer || null });
  } catch (err) {
    if (err?.code === 'device') await unpair({ notifyPc: false, reason: UNPAIRED_BY_PC });
    /* otherwise PC not reachable: nothing to show */
  }
}

/** Phone sync history, most recent first. */
export async function getSyncLog() {
  return (await getMeta('syncLog')) || [];
}
