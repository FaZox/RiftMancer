import { tx } from './i18n.js';
/**
 * The app's last errors on this device (lot 5 of AMELIORATIONS-APPLI.md):
 * uncaught errors, refused promises, the screens that crashed (ErrorBoundary)
 * and the start-up steps that failed. The 200 most recent are kept, cleaned
 * (scrub), for the diagnostic report. Kept in localStorage (per device, never
 * sent anywhere: the report is a file the user gives).
 */
const KEY = 'rb.errors';
export const MAX_ERRORS = 200;

/**
 * Removes what must never leave the device from a text: IP addresses, user
 * folders (C:\Users\<name>), secrets in « key=… », long keys / tokens, query
 * strings, and the names given in `redact` (people, decks, boxes, devices).
 */
export function scrub(text, redact = []) {
  let s = String(text ?? '');
  s = s.replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '<ip>');
  s = s.replace(/\b[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){3,7}\b/gi, '<ip>');
  s = s.replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\s'"]+/gi, '$1…').replace(/(\/(?:home|Users)\/)[^/\s'"]+/g, '$1…');
  s = s.replace(/\b(token|key|secret|password|passwd|pass|pwd|sig|signature)(["']?\s*[=:]\s*["']?)[^\s"',;&]+/gi, '$1$2<masqué>');
  s = s.replace(/[?#][^\s'"]*/g, (q) => (q.length > 1 ? '' : q));
  s = s.replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, '<…>');
  for (const name of redact) {
    const n = String(name || '').trim();
    if (n.length >= 2) s = s.split(n).join('<nom>');
  }
  return s.slice(0, 500);
}

function read() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

/** Records an error: `where` (« DeckEditor », « démarrage : catalogue »…). */
export function logError(error, where = '') {
  const e = error instanceof Error ? error : new Error(String(error?.message || error));
  const entry = {
    at: Date.now(),
    where: scrub(where).slice(0, 80),
    type: e.name || 'Error',
    message: scrub(e.message),
    // first frames only, cleaned (file names, no user folder)
    stack: scrub((e.stack || '').split('\n').slice(1, 4).map(l => l.trim()).join(' | ')),
  };
  const list = [entry, ...read()].slice(0, MAX_ERRORS);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or off */ }
  return entry;
}

export const getErrors = () => read();
export function clearErrors() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

let installed = false;
/** Uncaught errors and refused promises of the page go to the log. */
export function installErrorLog() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (ev) => { if (ev.error || ev.message) logError(ev.error || ev.message, tx('erreur non gérée')); });
  window.addEventListener('unhandledrejection', (ev) => logError(ev.reason, tx('promesse rejetée')));
}

const SPEED_KEY = 'rb.lastSpeed';
/** « Tester la vitesse »: the last result, for the report. Returns `result`. */
export function rememberSpeed(result, detection) {
  try { localStorage.setItem(SPEED_KEY, JSON.stringify({ at: Date.now(), detection, ...result })); } catch { /* ignore */ }
  return result;
}
export function lastSpeed() {
  try { return JSON.parse(localStorage.getItem(SPEED_KEY) || 'null'); } catch { return null; }
}
