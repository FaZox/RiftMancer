/**
 * Content-Security-Policy of the app.
 *   - PC: sent as an HTTP header by the local server (server.cjs) for HTML pages.
 *   - Android: written as a <meta> into dist-mobile/index.html (build-mobile.mjs).
 * WASM (ONNX detector) needs 'wasm-unsafe-eval'; Tailwind/React inline styles
 * need 'unsafe-inline' for styles only. Scripts: the app's own files only.
 */
const COMMON = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'font-src': ["'self'", 'data:'],
  'media-src': ["'self'", 'blob:', 'mediastream:'],
  'worker-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'none'"],
};
const PRICE_HOSTS = ['https://downloads.s3.cardmarket.com', 'https://api.rifthunt.com', 'https://api.riftcodex.com'];

function build(extra) {
  const p = { ...COMMON, ...extra };
  return Object.entries(p).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}

// PC window: everything comes from http://127.0.0.1:47321 ('self').
const PC_CSP = build({
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'", 'data:', 'blob:', ...PRICE_HOSTS],
});

// Android WebView (http://localhost): images, catalogue and sync come from the
// PC on the local network (any address; port 47321, or 47322 for the test
// app). `http:` without a host: a « http://*:port » source is not matched
// reliably against IP addresses by every WebView. The sync itself is
// end-to-end encrypted (syncProtocol.js).
const MOBILE_CSP = build({
  'img-src': ["'self'", 'data:', 'blob:', 'http:'],
  'connect-src': ["'self'", 'data:', 'blob:', 'http:', ...PRICE_HOSTS],
});

module.exports = { PC_CSP, MOBILE_CSP };
