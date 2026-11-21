/**
 * Scan statistics on this device: how many scans, recognised, not
 * recognised, corrected, undone — in total and for the current session.
 * Kept in localStorage (a per-device convenience; not synced).
 */
const KEY = 'rb.scanStats';
const EMPTY = { scans: 0, success: 0, fail: 0, duplicate: 0, corrected: 0, undone: 0, manual: 0 };
const session = { ...EMPTY, since: Date.now() };

function readTotal() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...EMPTY }; }
}

/** Count one event: 'scans' | 'success' | 'fail' | 'duplicate' | 'corrected' | 'undone' | 'manual'. */
export function countScan(event) {
  session[event] = (session[event] || 0) + 1;
  const total = readTotal();
  total[event] = (total[event] || 0) + 1;
  try { localStorage.setItem(KEY, JSON.stringify(total)); } catch { /* storage unavailable */ }
}

export function getScanStats() {
  return { session: { ...session }, total: readTotal() };
}

export function resetScanStats() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  Object.assign(session, EMPTY, { since: Date.now() });
}
