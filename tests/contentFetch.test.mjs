// CORRECTIONS-v3 C: redirects checked at every step, size limit before and while reading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { fetchContent, MAX_BYTES } = require('../electron/contentFetch.cjs');

const START = 'https://riftboundfr.fr/textes-cartes.json';
const OTHER = 'https://riftboundfr.fr/repertoire-cartes.json';

/** fetch simulated from a map url → [status, body, headers]; records the calls. */
function site(routes) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, redirect: opts.redirect });
    const r = routes[url];
    if (!r) throw new Error('ENOTFOUND');
    const [status, body, headers = {}] = r;
    return new Response(status === 304 || (status >= 300 && status < 400) ? null : body, { status, headers });
  };
  return { impl, calls };
}

test('a redirect to an address that is not allowed is refused', async () => {
  const s = site({ [START]: [302, null, { location: 'https://evil.example/textes.json' }] });
  const r = await fetchContent(START, { fetchImpl: s.impl });
  assert.deepEqual(r, { ok: false, reason: 'forbidden-url', status: 302 });
  assert.deepEqual(s.calls.map(c => c.url), [START], 'the other site is never asked');
  assert.equal(s.calls[0].redirect, 'manual', 'never followed automatically');
});

test('a redirect to an allowed address is followed (relative too)', async () => {
  const s = site({
    [START]: [301, null, { location: '/repertoire-cartes.json' }],
    [OTHER]: [200, '{"ok":1}', { 'content-type': 'application/json' }],
  });
  const r = await fetchContent(START, { fetchImpl: s.impl });
  assert.equal(r.ok, true);
  assert.equal(r.text, '{"ok":1}');
  assert.deepEqual(s.calls.map(c => c.url), [START, OTHER]);
});

test('more than 3 redirects → refused', async () => {
  const s = site({ [START]: [302, null, { location: OTHER }], [OTHER]: [302, null, { location: START }] });
  const r = await fetchContent(START, { fetchImpl: s.impl });
  assert.equal(r.reason, 'too-many-redirects');
  assert.equal(s.calls.length, 4, 'the first request and 3 redirects');
});

test('a declared length over 30 MB is refused without reading the body', async () => {
  let pulled = 0;
  const body = new ReadableStream({ pull(c) { pulled++; c.enqueue(new Uint8Array(1024)); } });
  const impl = async () => new Response(body, { status: 200, headers: { 'content-length': String(MAX_BYTES + 1), 'content-type': 'application/json' } });
  const r = await fetchContent(START, { fetchImpl: impl });
  assert.deepEqual(r, { ok: false, reason: 'too-big', status: 200 });
  assert.ok(pulled <= 1, `body not read (${pulled})`);
});

test('a body without length that goes over 30 MB is stopped while reading', async () => {
  const CHUNK = 1024 * 1024;
  let sent = 0;
  const body = new ReadableStream({ pull(c) { sent += CHUNK; c.enqueue(new Uint8Array(CHUNK)); } }); // endless
  const impl = async () => new Response(body, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
  const r = await fetchContent('https://cmsassets.rgpub.io/x/card.webp', { binary: true, fetchImpl: impl });
  assert.equal(r.reason, 'too-big');
  assert.ok(sent <= MAX_BYTES + 3 * CHUNK, `stopped near the limit (${sent / CHUNK} MB read)`);
  // under the limit: read entirely
  const small = async () => new Response(new Uint8Array(5000), { status: 200, headers: { 'content-type': 'image/webp' } });
  const ok = await fetchContent('https://cmsassets.rgpub.io/x/card.webp', { binary: true, fetchImpl: small });
  assert.equal(ok.bytes.length, 5000);
});
