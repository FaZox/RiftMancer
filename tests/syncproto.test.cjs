/* Sync protocol v3: phone client (src/lib/syncProtocol.js, WebCrypto) against the real PC server. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sc = require('../electron/syncCrypto.cjs');
const { startPc, pairPhone, signed, proto } = require('./syncHelpers.cjs');

test('pairing: one key per phone, then sync / status / prices with it', async () => {
  const pc = await startPc();
  const phone = await pairPhone(pc);
  assert.match(phone.deviceKey, /^[0-9a-f]{64}$/);
  assert.equal(phone.name, 'PC test');
  const res = await phone.request('/api/sync', { method: 'POST', body: { since: 0, push: {} } });
  assert.equal(typeof res.seq, 'number');
  assert.equal((await phone.request('/api/status')).name, 'PC test');
  assert.equal((await phone.request('/api/prices')).prices.updatedAt, 5);
  // The PC keeps the key in the main process: listed with the phone
  assert.equal(pc.store.getMeta('devices', {})[phone.deviceId].key, phone.deviceKey);
  pc.close();
});

test('pairing only while the QR code is shown (window) → otherwise 403', async () => {
  const pc = await startPc();
  const { deriveKeys, secureRequest } = await proto;
  await assert.rejects(
    secureRequest(fetch, pc.base, '/api/pair', await deriveKeys(pc.token), { method: 'POST', body: { deviceName: 'x' } }),
    (e) => e.status === 403,
  );
  pc.openPairing(-1); // closed
  await assert.rejects(
    secureRequest(fetch, pc.base, '/api/pair', await deriveKeys(pc.token), { method: 'POST', body: {} }),
    (e) => e.status === 403,
  );
  pc.close();
});

test('the QR code secret is not enough to sync, and a wrong QR secret cannot pair', async () => {
  const pc = await startPc();
  const { deriveKeys, secureRequest } = await proto;
  const viaQr = signed(pc.token, 'GET', '/api/status', { deviceId: 'whatever' });
  assert.equal((await fetch(pc.base + '/api/status', { headers: viaQr.headers })).status, 401);
  pc.openPairing();
  await assert.rejects(
    secureRequest(fetch, pc.base, '/api/pair', await deriveKeys('autre-secret'), { method: 'POST', body: {} }),
    (e) => e.status === 401,
  );
  pc.close();
});

test('« Dissocier » on the PC: that phone is cut off (even with another id), the others go on', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc, 'A');
  const b = await pairPhone(pc, 'B');
  // what main.cjs sync:removeDevice does
  const devices = pc.store.getMeta('devices', {});
  delete devices[a.deviceId];
  pc.store.setMeta('devices', devices);
  await assert.rejects(a.request('/api/status'), (e) => e.status === 401 && e.code === 'device');
  // Same key, another device id (the phone made one up) → still refused
  const { secureRequest } = await proto;
  await assert.rejects(secureRequest(fetch, pc.base, '/api/status', a.keys, { deviceId: crypto.randomUUID() }), (e) => e.status === 401);
  await assert.rejects(secureRequest(fetch, pc.base, '/api/status', a.keys, { deviceId: b.deviceId }), (e) => e.status === 401);
  // B is not touched
  assert.equal((await b.request('/api/status')).name, 'PC test');
  // A scans the QR code again → new key, works
  const a2 = await pairPhone(pc, 'A');
  assert.equal((await a2.request('/api/status')).name, 'PC test');
  pc.close();
});

test('« Dissocier » on the phone: it leaves the PC list', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc);
  await a.request('/api/unpair', { method: 'POST', body: {} });
  assert.equal(pc.store.getMeta('devices', {})[a.deviceId], undefined);
  await assert.rejects(a.request('/api/status'), (e) => e.status === 401);
  pc.close();
});

test('the answer body is not readable without the key', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc);
  const req = signed(a.deviceKey, 'GET', '/api/status', { deviceId: a.deviceId });
  const r = await fetch(pc.base + '/api/status', { headers: req.headers });
  assert.equal(r.status, 200);
  assert.ok(!Buffer.from(await r.arrayBuffer()).toString('latin1').includes('PC test'));
  pc.close();
});

test('wrong signature → 401; old Bearer token → 401', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc);
  const req = signed(a.deviceKey, 'GET', '/api/status', { deviceId: a.deviceId, sigKey: crypto.randomBytes(32) });
  assert.equal((await fetch(pc.base + '/api/status', { headers: req.headers })).status, 401);
  assert.equal((await fetch(pc.base + '/api/prices', { headers: { Authorization: `Bearer ${pc.token}` } })).status, 401);
  pc.close();
});

test('replayed nonce → 401', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc);
  const req = signed(a.deviceKey, 'POST', '/api/sync', { deviceId: a.deviceId, body: { since: 0, push: {} } });
  const send = () => fetch(pc.base + '/api/sync', { method: 'POST', headers: req.headers, body: req.payload });
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 401);
  pc.close();
});

test('timestamp more than 5 min off → 401 clock, and the client adapts once', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc);
  const req = signed(a.deviceKey, 'GET', '/api/status', { deviceId: a.deviceId, time: Date.now() - 6 * 60 * 1000 });
  const r = await fetch(pc.base + '/api/status', { headers: req.headers });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, 'clock');
  const realNow = Date.now;
  Date.now = () => realNow() + 3600 * 1000;
  try {
    assert.equal((await a.request('/api/status')).name, 'PC test');
  } finally {
    Date.now = realNow;
  }
  pc.close();
});

test('altered body → decryption fails → 400', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc);
  const keys = sc.deriveKeys(a.deviceKey);
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = sc.encrypt(keys, Buffer.from('{"since":0}'), `req|POST|/api/sync|${nonce}`);
  payload[20] ^= 0xff;
  const time = Date.now();
  const sig = crypto.createHmac('sha256', keys.macKey).update(sc.canonical('POST', '/api/sync', time, nonce, payload)).digest('hex');
  const r = await fetch(pc.base + '/api/sync', { method: 'POST', headers: { 'X-RB-Time': String(time), 'X-RB-Nonce': nonce, 'X-RB-Sig': sig, 'X-RB-Device': a.deviceId }, body: payload });
  assert.equal(r.status, 400);
  pc.close();
});

test('hello: public, anonymous, daily fingerprint (yesterday / tomorrow accepted, 3 days ago not)', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc);
  const hello = await fetch(pc.base + '/api/hello').then(r => r.json());
  assert.deepEqual(Object.keys(hello).sort(), ['app', 'pcIdHash', 'proto']);
  assert.equal(hello.proto, 3);
  const { deriveKeys, helloHash, helloHashes, utcDay } = await proto;
  const pcKeys = await deriveKeys(a.pcSecret);
  const day = 24 * 3600 * 1000;
  assert.equal(hello.pcIdHash, await helloHash(pcKeys));
  assert.ok((await helloHashes(pcKeys)).has(hello.pcIdHash));
  assert.ok((await helloHashes(pcKeys, Date.now() - day)).has(hello.pcIdHash), 'phone a day behind');
  assert.ok((await helloHashes(pcKeys, Date.now() + day)).has(hello.pcIdHash), 'phone a day ahead');
  assert.ok(!(await helloHashes(pcKeys, Date.now() - 3 * day)).has(hello.pcIdHash));
  assert.notEqual(await helloHash(pcKeys, utcDay(Date.now() - day)), hello.pcIdHash, 'changes every day');
  assert.notEqual(hello.pcIdHash, await helloHash(await deriveKeys(pc.token)), 'not derived from the QR secret');
  pc.close();
});

test('CORS: only the app WebView origin is allowed', async () => {
  const pc = await startPc();
  const ok = await fetch(pc.base + '/api/hello', { headers: { Origin: 'http://localhost' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost');
  const evil = await fetch(pc.base + '/api/hello', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const pre = await fetch(pc.base + '/api/sync', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert.equal(pre.status, 403);
  const preOk = await fetch(pc.base + '/api/sync', { method: 'OPTIONS', headers: { Origin: 'http://localhost' } });
  assert.match(preOk.headers.get('access-control-allow-headers'), /X-RB-Device/);
  pc.close();
});

test('too many failed attempts → 429', async () => {
  const pc = await startPc();
  let last;
  for (let i = 0; i < 21; i++) {
    const req = signed(pc.token, 'GET', '/api/status', { deviceId: 'nope', sigKey: crypto.randomBytes(32) });
    last = await fetch(pc.base + '/api/status', { headers: req.headers });
  }
  assert.equal(last.status, 429);
  pc.close();
});

test('catalog hash (SHA-256) computed by the phone matches the PC catalogVersion', async () => {
  const { catalogHash } = await proto;
  const text = '{"cards":[]}';
  assert.equal(await catalogHash(text), crypto.createHash('sha256').update(Buffer.from(text)).digest('hex'));
});

test('matches and learned examples are synced like the other collections', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc, 'A');
  const b = await pairPhone(pc, 'B');
  const match = { id: 'm1', updatedAt: 10, deleted: false, result: 'win', myLegendId: 'ogn-251-298', oppLegendId: 'ogn-253-298', date: 5 };
  const res = await a.request('/api/sync', { method: 'POST', body: { since: 0, push: { matches: [match] } } });
  assert.ok(res.collections.includes('matches') && res.collections.includes('learned'));
  assert.deepEqual(pc.store.load('matches').map(m => m.id), ['m1']);
  const other = await b.request('/api/sync', { method: 'POST', body: { since: 0, push: {} } });
  assert.deepEqual(other.pull.matches.map(m => m.result), ['win']);
  pc.close();
});

test('phone clock one hour ahead: its dates are corrected, the PC restore still wins', async () => {
  const pc = await startPc();
  const a = await pairPhone(pc);
  const real = Date.now();
  pc.store.putLocal('copies', [{ id: 'c1', cardId: 'ogn-001-298', updatedAt: real - 10 * 60000, deleted: false, condition: 'restauré' }]);
  const phoneNow = real + 3600000;
  const edit = { id: 'c1', cardId: 'ogn-001-298', updatedAt: phoneNow - 30 * 60000, deleted: false, condition: 'téléphone' };
  const res = await a.request('/api/sync', { method: 'POST', body: { since: 0, push: { copies: [edit] }, clientNow: phoneNow } });
  assert.ok(Math.abs(res.clockSkew + 3600000) < 5000, String(res.clockSkew));
  assert.equal(pc.store.load('copies')[0].condition, 'restauré');
  const fresh = { ...edit, updatedAt: phoneNow - 60000, condition: 'récent' };
  await a.request('/api/sync', { method: 'POST', body: { since: 0, push: { copies: [fresh] }, clientNow: Date.now() + 3600000 } });
  const row = pc.store.load('copies')[0];
  assert.equal(row.condition, 'récent');
  assert.ok(row.updatedAt <= Date.now(), 'never in the future');
  pc.close();
});

test('clockSkew: tolerance and cap', () => {
  const { clockSkew } = require('../electron/server.cjs');
  assert.equal(clockSkew(1000 - 10000, 1000), 0);
  assert.equal(clockSkew(undefined), 0);
  assert.equal(clockSkew(0, 3600000), 0);
  assert.equal(clockSkew(1, 1 + 30 * 24 * 3600 * 1000), 7 * 24 * 3600 * 1000);
});
