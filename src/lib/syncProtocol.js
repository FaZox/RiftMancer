import { tx } from './i18n.js';
/**
 * Sync protocol v3 — phone side (WebCrypto). PC side: electron/syncCrypto.cjs,
 * which documents the format. Secrets are never sent in clear: requests are
 * signed (HMAC) and bodies encrypted (AES-256-GCM) with keys derived
 * (HKDF-SHA256) from this phone's own key — or from the QR code secret for
 * the pairing request only.
 */

export const PROTO = 3;
const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

const hex = (buf) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return hex(a);
}

/** { encKey, macKey } CryptoKeys derived from the pairing secret. */
export async function deriveKeys(secret) {
  const ikm = await subtle().importKey('raw', enc.encode(String(secret)), 'HKDF', false, ['deriveBits']);
  const bits = (info) => subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('riftbound-sync-v2'), info: enc.encode(info) }, ikm, 256);
  const [encBits, macBits] = await Promise.all([bits('enc'), bits('mac')]);
  return {
    encKey: await subtle().importKey('raw', encBits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']),
    macKey: await subtle().importKey('raw', macBits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
  };
}

async function hmacHex(keys, text) {
  return hex(await subtle().sign('HMAC', keys.macKey, enc.encode(text)));
}

/** UTC day « AAAA-MM-JJ ». */
export function utcDay(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

/** `pcIdHash` of /api/hello for the PC holding this PC secret, for one day. */
export async function helloHash(keys, day = utcDay()) {
  return (await hmacHex(keys, `hello|${day}`)).slice(0, 32);
}

/** Fingerprints accepted now: yesterday, today, tomorrow (clock skew, midnight). */
export async function helloHashes(keys, now = Date.now()) {
  const day = 24 * 3600 * 1000;
  return new Set(await Promise.all([now - day, now, now + day].map(t => helloHash(keys, utcDay(t)))));
}

async function encrypt(keys, bytes, aad) {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, keys.encKey, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return out;
}

async function decrypt(keys, bytes, aad) {
  const data = new Uint8Array(bytes);
  if (data.length < 28) throw new Error(tx('réponse trop courte'));
  return subtle().decrypt({ name: 'AES-GCM', iv: data.subarray(0, 12), additionalData: enc.encode(aad) }, keys.encKey, data.subarray(12));
}

/** Clock difference with the PC (ms), learnt when the PC refuses our time. */
let clockOffset = 0;
export function getClockOffset() { return clockOffset; }

export class SyncHttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Signed (and, with a body, encrypted) request to the PC; returns the
 * decrypted JSON answer.
 * @param {(url: string, opts: object) => Promise<Response>} fetchFn  fetch, or one with a timeout
 */
export async function secureRequest(fetchFn, base, path, keys, { method = 'GET', body, deviceId } = {}, retry = true) {
  const time = Date.now() + clockOffset;
  const nonce = randomHex(16);
  const payload = body === undefined ? new Uint8Array(0)
    : await encrypt(keys, enc.encode(JSON.stringify(body)), `req|${method}|${path}|${nonce}`);
  const bodyHash = hex(await subtle().digest('SHA-256', payload));
  const sig = await hmacHex(keys, `${method}\n${path}\n${time}\n${nonce}\n${bodyHash}`);
  const headers = { 'X-RB-Time': String(time), 'X-RB-Nonce': nonce, 'X-RB-Sig': sig };
  if (deviceId) headers['X-RB-Device'] = deviceId; // whose key signed the request
  if (payload.length) headers['Content-Type'] = 'application/octet-stream';
  const r = await fetchFn(base + path, { method, headers, body: payload.length ? payload : undefined });
  if (!r.ok) {
    let j = null;
    try { j = await r.json(); } catch { /* not JSON */ }
    if (r.status === 401 && j?.error === 'clock' && retry && Number.isFinite(j.serverTime)) {
      // The phone's clock is off: adopt the PC's time and try once more.
      clockOffset = j.serverTime - Date.now();
      return secureRequest(fetchFn, base, path, keys, { method, body, deviceId }, false);
    }
    if (r.status === 401 && j?.error === 'device') throw new SyncHttpError(401, 'device', tx('Le PC a dissocié ce téléphone. Scannez à nouveau son QR code pour synchroniser.'));
    if (r.status === 401) throw new SyncHttpError(401, j?.error || 'unauthorized', tx('Clé d’appairage refusée par le PC : scannez à nouveau le QR code.'));
    if (r.status === 403) throw new SyncHttpError(403, j?.error || 'forbidden', tx('Appairage fermé : sur le PC, ouvrez Réglages → Synchronisation pour afficher le QR code, puis scannez-le à nouveau.'));
    if (r.status === 429) throw new SyncHttpError(429, 'rate', tx('Trop de tentatives refusées : réessayez dans une minute.'));
    throw new SyncHttpError(r.status, 'http', tx('PC : erreur {status}', { status: r.status }));
  }
  const plain = await decrypt(keys, await r.arrayBuffer(), `res|${nonce}`);
  return JSON.parse(dec.decode(plain));
}

/** SHA-256 (hex) of a text — the PC's `catalogVersion` / `banlistVersion` format. */
export async function catalogHash(text) {
  return hex(await subtle().digest('SHA-256', enc.encode(text)));
}
