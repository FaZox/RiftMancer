/* Test helpers: a PC server on a free port, and phones paired with it (protocol v3). */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Store } = require('../electron/store.cjs');
const { createServer } = require('../electron/server.cjs');
const sc = require('../electron/syncCrypto.cjs');

const proto = import('../src/lib/syncProtocol.js');

async function startPc(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-pc-'));
  const store = new Store(path.join(dir, 'collection.sqlite'));
  const api = createServer({ store, distDir: dir, getName: () => 'PC test', getPrices: () => ({ prices: { updatedAt: 5 }, history: [] }), ...extra });
  await new Promise(r => api.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${api.server.address().port}`;
  const { token } = store.identity();
  return { ...api, store, base, token, dir, close: () => api.server.close() };
}

/** Pairs a phone (the QR code is shown: pairing window open). */
async function pairPhone(pc, name = 'Pixel') {
  const { deriveKeys, secureRequest } = await proto;
  pc.openPairing();
  const res = await secureRequest(fetch, pc.base, '/api/pair', await deriveKeys(pc.token), { method: 'POST', body: { deviceName: name } });
  const keys = await deriveKeys(res.deviceKey);
  const request = (p, opts = {}) => secureRequest(fetch, pc.base, p, keys, { ...opts, deviceId: res.deviceId });
  return { ...res, keys, request };
}

/** Raw signed request built by hand (to tamper with it), node:crypto side. */
function signed(secret, method, pathname, { body, time = Date.now(), nonce = crypto.randomBytes(16).toString('hex'), sigKey, deviceId } = {}) {
  const keys = sc.deriveKeys(secret);
  const payload = body === undefined ? Buffer.alloc(0) : sc.encrypt(keys, Buffer.from(JSON.stringify(body)), `req|${method}|${pathname}|${nonce}`);
  const mac = sigKey || keys.macKey;
  const sig = crypto.createHmac('sha256', mac).update(sc.canonical(method, pathname, time, nonce, payload)).digest('hex');
  const headers = { 'X-RB-Time': String(time), 'X-RB-Nonce': nonce, 'X-RB-Sig': sig };
  if (deviceId) headers['X-RB-Device'] = deviceId;
  return { nonce, payload, headers, keys };
}

module.exports = { startPc, pairPhone, signed, proto };
