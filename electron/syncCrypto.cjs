/**
 * Sync protocol v3 — PC side (node:crypto). Phone side: src/lib/syncProtocol.js.
 *
 * Secrets (never sent in clear on the network):
 *   - pairing secret (in the QR code): only signs /api/pair, and only while
 *     the QR code is shown on the PC (pairing window);
 *   - one key per phone, created by the PC at pairing and sent encrypted:
 *     every other request (X-RB-Device: <device id>) uses it, so
 *     « Dissocier » really cuts that phone off;
 *   - PC secret (sent at pairing): daily fingerprint of the PC in /api/hello
 *     and mDNS, recognisable by its phones only, different every day.
 * From each secret, HKDF-SHA256 derives two keys:
 *   encKey (AES-256-GCM)  — request / response bodies
 *   macKey (HMAC-SHA256)  — request signatures, PC fingerprint
 *
 * Every authenticated request carries:
 *   X-RB-Time  — client time (ms)
 *   X-RB-Nonce — 16 random bytes (hex), refused if seen in the last 10 min
 *   X-RB-Sig   — HMAC(macKey, METHOD \n PATH \n time \n nonce \n sha256hex(body))
 * Bodies are iv(12) | AES-GCM ciphertext | tag(16), with associated data
 *   request : "req|METHOD|PATH|nonce"     response: "res|nonce"
 * (a response cannot be replayed for another request).
 */
const crypto = require('node:crypto');

const PROTO = 3;
const SALT = Buffer.from('riftbound-sync-v2');
const MAX_SKEW = 5 * 60 * 1000;
const NONCE_TTL = 10 * 60 * 1000;

function deriveKeys(secret) {
  const ikm = Buffer.from(String(secret), 'utf8');
  return {
    encKey: Buffer.from(crypto.hkdfSync('sha256', ikm, SALT, Buffer.from('enc'), 32)),
    macKey: Buffer.from(crypto.hkdfSync('sha256', ikm, SALT, Buffer.from('mac'), 32)),
  };
}

const sha256hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const hmacHex = (key, text) => crypto.createHmac('sha256', key).update(text).digest('hex');

function canonical(method, path, time, nonce, body) {
  return `${method.toUpperCase()}\n${path}\n${time}\n${nonce}\n${sha256hex(body || Buffer.alloc(0))}`;
}

/** UTC day « AAAA-MM-JJ » of a time (the PC fingerprint changes every day). */
function utcDay(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Fingerprint of the PC for /api/hello and mDNS: only a phone holding the PC
 * secret can check it, and it changes every day (a PC cannot be followed
 * from one place to another by its fingerprint).
 */
function helloHash(keys, day = utcDay()) {
  return hmacHex(keys.macKey, `hello|${day}`).slice(0, 32);
}

function encrypt(keys, plaintext, aad) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keys.encKey, iv);
  c.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]);
}

/** Throws if the data was altered or encrypted with another key. */
function decrypt(keys, data, aad) {
  if (data.length < 28) throw new Error('too short');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(data.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', keys.encKey, iv);
  d.setAAD(Buffer.from(aad, 'utf8'));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data.subarray(12, data.length - 16)), d.final()]);
}

/** Remembers recent nonces (anti-replay). */
class NonceCache {
  constructor(ttl = NONCE_TTL) { this.ttl = ttl; this.map = new Map(); }
  /** false if the nonce was already used. */
  use(nonce, now = Date.now()) {
    if (this.map.size > 1000) for (const [n, exp] of this.map) if (exp < now) this.map.delete(n);
    const exp = this.map.get(nonce);
    if (exp && exp > now) return false;
    this.map.set(nonce, now + this.ttl);
    return true;
  }
}

/**
 * Checks the signature headers of a request.
 * @returns {{ ok: true, nonce: string } | { ok: false, error: 'auth'|'clock'|'replay' }}
 */
function verifyRequest(keys, { method, path, headers, body }, nonces, now = Date.now()) {
  const time = Number(headers['x-rb-time']);
  const nonce = String(headers['x-rb-nonce'] || '');
  const sig = String(headers['x-rb-sig'] || '');
  if (!Number.isFinite(time) || !/^[0-9a-f]{32}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(sig)) return { ok: false, error: 'auth' };
  const expected = Buffer.from(hmacHex(keys.macKey, canonical(method, path, time, nonce, body)), 'hex');
  const got = Buffer.from(sig, 'hex');
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return { ok: false, error: 'auth' };
  if (Math.abs(now - time) > MAX_SKEW) return { ok: false, error: 'clock' };
  if (!nonces.use(nonce, now)) return { ok: false, error: 'replay' };
  return { ok: true, nonce };
}

module.exports = { PROTO, deriveKeys, helloHash, utcDay, encrypt, decrypt, verifyRequest, canonical, NonceCache, MAX_SKEW };
