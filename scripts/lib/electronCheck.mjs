/**
 * Is the Electron shipped in the PC app still maintained and up to date?
 * (CORRECTIONS-v3 A.2) Electron only maintains its 3 latest major versions,
 * and each patch release carries Chromium security fixes.
 *
 * electronStatus({ installed, time, now }) — `time` is `npm view electron time`
 * ({ "45.4.1": "2026-11-19T…", … }). Returns { ok, problems, latest, behindDays }:
 *   - the installed major must be one of the 3 latest stable majors;
 *   - a newer patch of the same major must not have been out for more than
 *     `maxDays` (30) days.
 */
const STABLE = /^(\d+)\.(\d+)\.(\d+)$/;
const DAY = 86400000;

const parse = (v) => STABLE.exec(v)?.slice(1).map(Number) ?? null;
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function electronStatus({ installed, time, now = Date.now(), maxDays = 30, keepMajors = 3 }) {
  const mine = parse(installed);
  if (!mine) return { ok: false, problems: [`version d’Electron illisible : ${installed}`] };
  const stable = Object.keys(time || {}).map(v => [v, parse(v)]).filter(([, p]) => p);
  const majors = [...new Set(stable.map(([, p]) => p[0]))].sort((a, b) => b - a);
  const problems = [];
  if (!majors.slice(0, keepMajors).includes(mine[0])) {
    problems.push(`Electron ${mine[0]} n’est plus maintenu (versions maintenues : ${majors.slice(0, keepMajors).join(', ')}) : passer à une version récente`);
  }
  const newer = stable.filter(([, p]) => p[0] === mine[0] && cmp(p, mine) > 0).sort((a, b) => cmp(a[1], b[1]));
  const latest = newer.length ? newer[newer.length - 1][0] : installed;
  let behindDays = 0;
  if (newer.length) {
    const firstNewer = Date.parse(time[newer[0][0]]);
    behindDays = Math.floor((now - firstNewer) / DAY);
    if (behindDays > maxDays) problems.push(`Electron ${installed} a ${behindDays} jours de retard : ${latest} est sortie (correctifs de sécurité de Chromium) — npm install electron@${latest} --save-dev --save-exact`);
  }
  return { ok: problems.length === 0, problems, latest, behindDays };
}
