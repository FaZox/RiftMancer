const { etx } = require('./i18n.cjs');
/**
 * The only network calls of lot 4 (AMELIORATIONS-APPLI.md, rule 4): made by
 * the PC app's main process, on the user's action (or the weekly check),
 * towards these addresses only:
 *   - Riot's tournament rules page and ban announcements (playriftbound.com);
 *   - Riot's official card gallery and its images (M7d);
 *   - the two French files of riftboundfr.fr (M7c).
 * Rule 5: the app says who it is (name and version), never pretends to be a
 * browser and never works around a refusal (anti-robot check, rate limit): it
 * reports it, and the screen offers the manual import.
 *
 * CORRECTIONS-v3 C: redirects are followed by hand (3 at most) and every
 * address is checked against ALLOWED — a site that redirects elsewhere is
 * refused, its new address must be added here after checking it; the 30 MB
 * limit is applied before reading (Content-Length) and while reading.
 */
const ALLOWED = [
  /^https:\/\/playriftbound\.com\/[a-z]{2}-[a-z]{2}\/news\/[a-z0-9-]+\/[a-z0-9-]+\/?$/,
  /^https:\/\/playriftbound\.com\/[a-z]{2}-[a-z]{2}\/card-gallery\/?$/, // the gallery since November 2026
  /^https:\/\/riftbound\.leagueoflegends\.com\/[a-z]{2}-[a-z]{2}\/card-gallery\/?$/, // its former address (redirects to the one above)
  /^https:\/\/cmsassets\.rgpub\.io\/[\w./%-]+\.(png|jpe?g|webp)$/,
  /^https:\/\/riftboundfr\.fr\/(repertoire-cartes|textes-cartes)\.json$/,
  // rifthunt.com, first source of the cards and banned cards (src/lib/rifthunt.js)
  /^https:\/\/api\.rifthunt\.com\/bulk\/(cards|rulings)$/,
  /^https:\/\/api\.rifthunt\.com\/cards\/search\?q=banned%3A(standard|2v2|upcoming)$/,
  // pictures of the printings Riot's server has not (promos, variants): rifthuntImage()
  /^https:\/\/images\.rifthunt\.com\/cards\/large\/front\/[a-z0-9]{2,8}\/[a-z0-9]{1,8}\/[a-z0-9-]{1,120}\.webp\?v=[0-9a-f]{6,64}$/,
];
const MAX_BYTES = 30 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REDIRECT = [301, 302, 303, 307, 308];
const TIMEOUT = 30000;

const allowed = (url) => typeof url === 'string' && ALLOWED.some(re => re.test(url));

/** A refusal page (anti-robot check) instead of the content. */
function looksRefused(status, type, text) {
  if ([401, 403, 429, 503].includes(status)) return true;
  return /text\/html/.test(type || '') && /captcha|cf-chl|challenge-platform|attention required|just a moment/i.test(text.slice(0, 20000));
}

/** The body, read as a stream and dropped as soon as it goes over `max` bytes: Buffer, or null when too big. */
async function readLimited(res, max) {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) { try { await reader.cancel(); } catch { /* ignore */ } return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c.buffer, c.byteOffset, c.length)), total);
}
const drop = async (res) => { try { await res.body?.cancel(); } catch { /* ignore */ } };

/**
 * GET `url`. Returns { ok: true, status, text|bytes, etag, lastModified,
 * notModified } or { ok: false, reason: 'offline' | 'refused' | 'http' |
 * 'too-big' | 'forbidden-url' | 'too-many-redirects', status? }. `etag` / `lastModified`: the values
 * of the previous download (conditional request: 304 → notModified).
 */
async function fetchContent(url, { version = '0', etag, lastModified, binary = false, fetchImpl = fetch } = {}) {
  if (!allowed(url)) return { ok: false, reason: 'forbidden-url' };
  const headers = { 'User-Agent': `RiftMancer/${version} (collection app, content update)` };
  if (etag) headers['If-None-Match'] = etag;
  if (lastModified) headers['If-Modified-Since'] = lastModified;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  let res;
  let current = url;
  try {
    // Redirects by hand: each new address must be allowed too
    for (let hops = 0; ; hops++) {
      res = await fetchImpl(current, { headers, redirect: 'manual', signal: ctrl.signal });
      if (!REDIRECT.includes(res.status)) break;
      const location = res.headers.get('location');
      await drop(res);
      if (!location) { clearTimeout(timer); return { ok: false, reason: 'http', status: res.status }; }
      if (hops >= MAX_REDIRECTS) { clearTimeout(timer); return { ok: false, reason: 'too-many-redirects', status: res.status }; }
      let next;
      try { next = new URL(location, current).href; } catch { next = null; }
      if (!allowed(next)) { clearTimeout(timer); return { ok: false, reason: 'forbidden-url', status: res.status }; }
      current = next;
    }
  } catch {
    clearTimeout(timer);
    return { ok: false, reason: 'offline' };
  }
  try {
    if (res.status === 304) return { ok: true, status: 304, notModified: true };
    const type = res.headers.get('content-type') || '';
    // The size limit before reading (declared length), then while reading
    if (Number(res.headers.get('content-length')) > MAX_BYTES) { await drop(res); return { ok: false, reason: 'too-big', status: res.status }; }
    const buf = await readLimited(res, MAX_BYTES);
    if (!buf) return { ok: false, reason: 'too-big', status: res.status };
    const text = binary ? '' : buf.toString('utf8');
    if (!res.ok || (!binary && looksRefused(res.status, type, text))) {
      // 402 / 404 / 410: the site or the file is gone (riftboundfr.fr was « DEPLOYMENT_DISABLED » on 18/11/2026)
      const reason = [402, 404, 410].includes(res.status) ? 'unavailable' : looksRefused(res.status, type, text) ? 'refused' : 'http';
      return { ok: false, reason, status: res.status };
    }
    return {
      ok: true, status: res.status, type,
      ...(binary ? { bytes: buf } : { text }),
      etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified'),
    };
  } catch {
    return { ok: false, reason: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** What the screen says for each failure (B.6.2), in the app's language (electron/i18n.cjs). */
const FETCH_TEXT = {
  offline: 'Impossible de joindre le site. Vérifiez votre connexion.',
  unavailable: 'Le site est indisponible pour l’instant (fichier introuvable ou site fermé).',
  refused: 'Le site n’accepte pas le téléchargement automatique.',
  http: 'Le site a répondu par une erreur. Réessaie plus tard.',
  'too-big': 'Le fichier reçu est trop gros : refusé.',
  'forbidden-url': 'Adresse non autorisée.',
  'too-many-redirects': 'Le site renvoie vers trop d’adresses successives : refusé.',
};
const FETCH_MESSAGE = new Proxy(FETCH_TEXT, { get: (t, k) => (t[k] ? etx(t[k]) : undefined) });

module.exports = { fetchContent, allowed, looksRefused, FETCH_MESSAGE, MAX_BYTES };
