/**
 * Local network server of the PC app.
 *
 *   - Serves the web app (dist/) to the Electron window.
 *   - Serves card data and images (card-hashes.json, cards/…) so the phone can
 *     download new sets and full-size images. These are public game assets.
 *   - Sync API for the paired phones (protocol v3, see syncCrypto.cjs: signed
 *     requests, encrypted bodies, one key per phone):
 *       GET  /api/hello  → public: { app, proto, pcIdHash } (daily fingerprint,
 *                          only a paired phone recognises this PC)
 *       POST /api/pair   → signed with the QR code secret, only while the QR
 *                          code is shown (openPairing): gives the phone its key
 *       GET  /api/status → name of the PC, « send to the phone » offer
 *       POST /api/sync   → push local changes, pull changes since `since`
 *                          mode 'both' (default) | 'push' (phone → PC only)
 *                          | 'pull' (PC → phone only)
 *       GET  /api/prices → Cardmarket prices downloaded by the PC
 *
 * Nothing leaves the local network: the phone talks directly to this PC.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PC_CSP } = require('./csp.cjs');
const sc = require('./syncCrypto.cjs');
const { etx } = require('./i18n.cjs');

const SYNCED_COLLECTIONS = ['copies', 'wishlist', 'boxes', 'decks', 'people', 'loans', 'trades', 'matches', 'learned'];
const MAX_BODY = 16 * 1024 * 1024;

// Origins allowed to call the server from another page (CORS): the Android
// app's WebView (androidScheme "http" → http://localhost). The PC window is
// same-origin and needs nothing.
const CORS_ORIGINS = new Set(['http://localhost', 'https://localhost', 'capacitor://localhost']);
// Static files the phone downloads from the PC.
const PHONE_FILES = /^\/(cards\/|models\/|card-hashes\.json$|banlist\.json$)/;

// Phone clock ahead / behind the PC's: the dates of the records it sends are
// shifted by the difference (beyond CLOCK_TOLERANCE, at most CLOCK_MAX), so
// « most recent change wins » compares real times. See clockSkew().
const CLOCK_TOLERANCE = 30 * 1000;
const CLOCK_MAX = 7 * 24 * 3600 * 1000;

/** PC time − phone time (ms) from the phone's `clientNow`; 0 when unknown or negligible. */
function clockSkew(clientNow, now = Date.now()) {
  const c = Number(clientNow);
  if (!Number.isFinite(c) || c <= 0) return 0;
  const skew = now - c;
  if (Math.abs(skew) < CLOCK_TOLERANCE) return 0;
  return Math.max(-CLOCK_MAX, Math.min(CLOCK_MAX, skew));
}

// Too many failed authentications from one address → 429 for a while.
const FAIL_LIMIT = 20;
const FAIL_WINDOW = 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
};

const PAIRING_WINDOW = 5 * 60 * 1000;

const APP_VERSION = require('../package.json').version;
const MAX_CONFLICTS = 50; // listed in a sync history line (the count is complete)

function createServer({ store, distDir, getName, onSynced, getPrices, content = null }) {
  let catalogCache = { mtime: 0, version: null };
  // Pairing is only accepted while the QR code is shown on the PC.
  let pairingUntil = 0;
  function openPairing(ms = PAIRING_WINDOW) {
    pairingUntil = Date.now() + ms;
    return pairingUntil;
  }

  /** SHA-256 of public/banlist.json (the phone checks the file it downloads). */
  function banlistVersion() {
    try {
      // Lot 4.1: the content layers' list when there is one (electron/content.cjs)
      const file = content?.resolve('/banlist.json') || path.join(distDir, 'banlist.json');
      return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    } catch {
      return null;
    }
  }

  function catalogVersion() {
    const file = content?.resolve('/card-hashes.json') || path.join(distDir, 'card-hashes.json');
    try {
      const { mtimeMs } = fs.statSync(file);
      if (mtimeMs !== catalogCache.mtime || file !== catalogCache.file) {
        // Version of the card catalog = SHA-256 of card-hashes.json (the phone checks the file it downloads)
        const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        catalogCache = { mtime: mtimeMs, version: hash, file };
      }
      return catalogCache.version;
    } catch {
      return null;
    }
  }

  function cors(req) {
    const origin = req.headers.origin;
    return origin && CORS_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
  }

  function send(res, status, body, headers = {}) {
    res.writeHead(status, { ...cors(res.req), ...headers });
    res.end(body);
  }

  function sendJSON(res, status, obj) {
    send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  }

  // Keys derived from the pairing secret (QR code; cached until « Régénérer la clé »).
  let keyCache = { token: null, keys: null };
  function pairingKeys() {
    const { token } = store.identity();
    if (keyCache.token !== token) keyCache = { token, keys: sc.deriveKeys(token) };
    return keyCache.keys;
  }
  // PC secret: daily fingerprint (hello, mDNS). Created once, sent to the phones at pairing.
  let pcCache = { secret: null, keys: null };
  function pcSecret() {
    let s = store.getMeta('pcSecret', null);
    if (!s) { s = crypto.randomBytes(32).toString('hex'); store.setMeta('pcSecret', s); }
    return s;
  }
  function pcKeys() {
    const s = pcSecret();
    if (pcCache.secret !== s) pcCache = { secret: s, keys: sc.deriveKeys(s) };
    return pcCache.keys;
  }
  /** Today's public fingerprint of this PC (also announced by mDNS). */
  function currentHelloHash() {
    return sc.helloHash(pcKeys());
  }
  // One key per phone (devices meta: { [deviceId]: { name, key, … } }).
  const deviceKeyCache = new Map();
  function deviceKeys(deviceId) {
    const dev = store.getMeta('devices', {})[deviceId];
    if (!dev?.key) return null;
    const c = deviceKeyCache.get(deviceId);
    if (c && c.key === dev.key) return c.keys;
    const keys = sc.deriveKeys(dev.key);
    deviceKeyCache.set(deviceId, { key: dev.key, keys });
    return keys;
  }
  const nonces = new sc.NonceCache();

  const failures = new Map(); // ip → { count, since }
  function ipOf(req) { return req.socket.remoteAddress || '?'; }
  function blocked(req) {
    const f = failures.get(ipOf(req));
    return !!f && Date.now() - f.since < FAIL_WINDOW && f.count >= FAIL_LIMIT;
  }
  function recordFailure(req) {
    const ip = ipOf(req);
    const now = Date.now();
    const f = failures.get(ip);
    if (!f || now - f.since >= FAIL_WINDOW) failures.set(ip, { count: 1, since: now });
    else f.count++;
    if (failures.size > 500) for (const [k, v] of failures) if (now - v.since >= FAIL_WINDOW) failures.delete(k);
  }

  /**
   * Checks the request signature and decrypts its body. Normal requests are
   * signed with the key of the phone named in X-RB-Device; /api/pair with
   * the QR code secret (`pairing: true`).
   * @returns {Promise<{ nonce: string, data: any, keys, deviceId: string|null } | null>} null → an error was already sent.
   */
  async function authenticate(req, res, pathname, { pairing = false } = {}) {
    if (blocked(req)) { sendJSON(res, 429, { error: 'too many attempts' }); return null; }
    const deviceId = pairing ? null : String(req.headers['x-rb-device'] || '').slice(0, 64);
    const keys = pairing ? pairingKeys() : deviceKeys(deviceId);
    if (!keys) {
      // Unknown or unpaired phone (« Dissocier » removed its key).
      recordFailure(req);
      sendJSON(res, 401, { error: 'device' });
      return null;
    }
    let raw;
    try {
      raw = await readBody(req);
    } catch {
      sendJSON(res, 413, { error: 'too large' });
      return null;
    }
    const v = sc.verifyRequest(keys, { method: req.method, path: pathname, headers: req.headers, body: raw }, nonces);
    if (!v.ok) {
      recordFailure(req);
      sendJSON(res, 401, v.error === 'clock' ? { error: 'clock', serverTime: Date.now() } : { error: 'unauthorized' });
      return null;
    }
    let data = null;
    if (raw.length) {
      try {
        data = JSON.parse(sc.decrypt(keys, raw, `req|${req.method}|${pathname}|${v.nonce}`).toString('utf8'));
      } catch {
        sendJSON(res, 400, { error: 'bad request' });
        return null;
      }
    }
    return { nonce: v.nonce, data, keys, deviceId };
  }

  /** Encrypted JSON answer (key of the request), bound to the request nonce. */
  function sendSecure(res, auth, obj) {
    const body = sc.encrypt(auth.keys, Buffer.from(JSON.stringify(obj), 'utf8'), `res|${auth.nonce}`);
    send(res, 200, body, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  async function handleSync(req, res) {
    const auth = await authenticate(req, res, '/api/sync');
    if (!auth) return;
    const body = auth.data;
    if (!body || typeof body !== 'object') return sendJSON(res, 400, { error: 'bad request' });
    // The phone is the one whose key signed the request (never what the body says).
    const deviceId = auth.deviceId;
    let since = Number(body.since) || 0;
    const mode = body.mode === 'push' || body.mode === 'pull' ? body.mode : 'both';

    // The phone knows a seq this PC never reached (database replaced):
    // ask it for a full resync.
    if (since > store.seq) return sendSecure(res, auth, { reset: true, seq: 0 });

    const pull = {};
    let changed = 0;
    let received = 0;
    const conflicts = [];
    const now = Date.now();
    const skew = clockSkew(body.clientNow, now);
    const fixTime = (r) => (skew && r && typeof r.updatedAt === 'number'
      ? { ...r, updatedAt: Math.min(now, r.updatedAt + skew) }
      : r);
    for (const col of SYNCED_COLLECTIONS) {
      // 'pull': the phone only receives — what it sends is ignored (kept pending there).
      const pushed = (mode !== 'pull' && Array.isArray(body.push?.[col]) ? body.push[col] : []).map(fixTime);
      received += pushed.length;
      const m = store.merge(col, pushed, deviceId, since);
      changed += m.changed;
      conflicts.push(...m.conflicts);
      // 'push': the phone only sends — nothing comes back.
      pull[col] = mode === 'push' ? [] : store.changesSince(col, since, deviceId, m.seqBefore);
    }
    // The phone received the PC's data: the PC's "send to the phone" request is done.
    if (mode !== 'push') store.setMeta('phoneOffer', null);

    const devices = store.getMeta('devices', {});
    devices[deviceId] = {
      ...devices[deviceId],
      name: String(body.deviceName || devices[deviceId]?.name || etx('Téléphone')).slice(0, 80),
      firstSync: devices[deviceId]?.firstSync || Date.now(),
      lastSync: Date.now(),
      // Lot 4.6: the phone's app version, seen at this sync (À propos, « quoi mettre à jour »)
      appVersion: /^\d+\.\d+\.\d+[\w.-]{0,20}$/.test(String(body.appVersion || '')) ? String(body.appVersion) : devices[deviceId]?.appVersion || null,
    };
    store.setMeta('devices', devices);

    sendSecure(res, auth, {
      // 'push' did not send anything back: the phone keeps its old position.
      seq: mode === 'push' ? since : store.seq, mode, pull, collections: SYNCED_COLLECTIONS, catalogVersion: catalogVersion(), banlistVersion: banlistVersion(),
      pricesUpdatedAt: getPrices?.()?.prices?.updatedAt || null,
      // The phone shows a warning above 2 min and converts the PC dates it receives.
      clockSkew: skew,
      appVersion: APP_VERSION, // lot 4.6: the phone shows it and says what to update
      // Records modified on both sides (the most recent was kept), for the phone's history.
      conflicts: conflicts.slice(0, MAX_CONFLICTS),
    });
    onSynced?.({ deviceId, mode, changed, received, sent: Object.values(pull).reduce((n, a) => n + a.length, 0), conflicts });
  }

  function serveStatic(req, res, pathname) {
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      return send(res, 400, 'bad path');
    }
    const root = path.resolve(distDir);
    let file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) return send(res, 403, 'forbidden');
    // Lot 4.1: the merged catalog / banned list and the new cards' images of
    // the content layers (names checked by content.resolve, files inside its folder).
    const layered = content?.resolve(rel) || null;
    if (layered) file = layered;
    let stat = null;
    try { stat = fs.statSync(file); } catch { /* not found */ }
    if (stat?.isDirectory()) {
      file = path.join(file, 'index.html');
      try { stat = fs.statSync(file); } catch { stat = null; }
    }
    if (!stat) {
      // Unknown asset → 404; unknown page → the app (single-page app).
      if (path.extname(rel)) return send(res, 404, 'not found');
      file = path.join(distDir, 'index.html');
      try { stat = fs.statSync(file); } catch { return send(res, 500, 'App not built: run "npm run build" first.'); }
    }
    const ext = path.extname(file).toLowerCase();
    const immutable = !layered && (rel.startsWith('/assets/') || rel.startsWith('/cards/') || rel.startsWith('/models/') || rel.startsWith('/ort/'));
    res.writeHead(200, {
      ...(PHONE_FILES.test(rel) ? cors(req) : {}),
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': immutable ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      ...(ext === '.html' ? { 'Content-Security-Policy': PC_CSP } : {}),
      // Cross-origin isolation: lets the detector (ONNX Runtime) use several
      // WASM threads (SharedArrayBuffer). Everything the PC window loads is
      // same-origin; the files the phone downloads stay readable (CORP cross-origin).
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': PHONE_FILES.test(rel) ? 'cross-origin' : 'same-origin',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'OPTIONS') {
        if (!cors(req)['Access-Control-Allow-Origin']) return send(res, 403, '');
        return send(res, 204, '', {
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-RB-Time, X-RB-Nonce, X-RB-Sig, X-RB-Device',
          'Access-Control-Max-Age': '86400',
        });
      }
      if (url.pathname === '/api/hello') {
        // Public: says nothing about the PC or its owner to a stranger.
        return sendJSON(res, 200, { app: 'riftbound-scanner', proto: sc.PROTO, pcIdHash: currentHelloHash() });
      }
      if (url.pathname === '/api/sync' && req.method === 'POST') return handleSync(req, res);
      // Pairing (the phone scanned the QR code shown on the PC): it receives
      // its own key. Refused when the QR code is not shown (window closed).
      if (url.pathname === '/api/pair' && req.method === 'POST') {
        if (Date.now() > pairingUntil) {
          recordFailure(req);
          return sendJSON(res, 403, { error: 'pairing closed' });
        }
        const auth = await authenticate(req, res, '/api/pair', { pairing: true });
        if (!auth) return;
        // A new id each time: a phone cannot take over another one's place.
        const deviceId = crypto.randomUUID();
        const deviceKey = crypto.randomBytes(32).toString('hex');
        const devices = store.getMeta('devices', {});
        devices[deviceId] = {
          name: String(auth.data?.deviceName || etx('Téléphone')).slice(0, 80),
          key: deviceKey,
          firstSync: Date.now(),
          pairedAt: Date.now(),
        };
        store.setMeta('devices', devices);
        onSynced?.({ deviceId, mode: 'pair', changed: 0, received: 0, sent: 0 });
        return sendSecure(res, auth, {
          deviceId, deviceKey, pcSecret: pcSecret(), name: getName(), pcId: store.identity().pcId,
        });
      }
      // « Dissocier » on the phone: it leaves the PC's list (its key is deleted).
      if (url.pathname === '/api/unpair' && req.method === 'POST') {
        const auth = await authenticate(req, res, '/api/unpair');
        if (!auth) return;
        const devices = store.getMeta('devices', {});
        if (devices[auth.deviceId]) {
          delete devices[auth.deviceId];
          store.setMeta('devices', devices);
          onSynced?.({ deviceId: auth.deviceId, mode: 'unpair', changed: 0, received: 0, sent: 0 });
        }
        return sendSecure(res, auth, { ok: true });
      }
      if (url.pathname === '/api/status' && req.method === 'GET') {
        const auth = await authenticate(req, res, '/api/status');
        if (!auth) return;
        // `offer`: the PC asked to send its data to the phone (« Envoyer sur le téléphone »).
        return sendSecure(res, auth, {
          pcId: store.identity().pcId, name: getName(), catalogVersion: catalogVersion(),
          offer: store.getMeta('phoneOffer', null), serverTime: Date.now(),
        });
      }
      if (url.pathname === '/api/prices' && req.method === 'GET') {
        const auth = await authenticate(req, res, '/api/prices');
        if (!auth) return;
        return sendSecure(res, auth, getPrices?.() || { prices: null, history: [] });
      }
      if (url.pathname.startsWith('/api/')) return sendJSON(res, 404, { error: 'not found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
      return serveStatic(req, res, url.pathname);
    } catch (err) {
      console.error('[server]', err);
      if (!res.headersSent) sendJSON(res, 500, { error: 'server error' });
      else res.end();
    }
  });

  return { server, catalogVersion, openPairing, currentHelloHash };
}

module.exports = { createServer, clockSkew };
