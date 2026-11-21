#!/usr/bin/env node
/**
 * eval-detector in N parts side by side, the cores shared out, then added up:
 *   node scripts/eval-detector-par.mjs --jobs 8 [eval-detector options]
 * Same report (--report, --dump) and same numbers as one eval-detector run:
 * each part takes every N-th scene, real photo and grid (--shard k/N), with
 * 32 / N cores for ONNX Runtime (--cores).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const jobs = Number(take('jobs', 8));
const report = path.resolve(root, take('report', 'model/eval-detector.json'));
const dump = take('dump', '');
// --cores-each 2: fewer cores per part (a training runs beside: its image loading needs the processor)
const coresEach = take("cores-each", null);
const cores = coresEach ? Number(coresEach) : Math.max(1, Math.floor(os.cpus().length / jobs));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-par-'));
const t0 = Date.now();
console.log(`${jobs} parties en parallèle, ${cores} cœurs chacune`);
const parts = await Promise.all(Array.from({ length: jobs }, (_, k) => new Promise((resolve, reject) => {
  const out = path.join(tmp, `r${k}.json`);
  const args = [path.join(root, 'scripts/eval-detector.mjs'), ...argv, '--shard', `${k}/${jobs}`, '--cores', String(cores), '--report', out, ...(dump ? ['--dump', path.join(tmp, `d${k}.json`)] : [])];
  const p = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', d => { err += d; });
  p.on('exit', c => (c === 0 ? resolve(JSON.parse(fs.readFileSync(out, 'utf8'))) : reject(new Error(`partie ${k} : code ${c}\n${err.slice(-2000)}`))));
})));

const merged = { ...parts[0], models: [] };
parts[0].models.forEach((m0, mi) => {
  const all = parts.map(p => p.models[mi]);
  const sum = (f) => all.reduce((a, m) => a + f(m.counts), 0);
  const kinds = {};
  for (const m of all) for (const [k, v] of Object.entries(m.counts.sim.kinds)) { kinds[k] ??= { gt: 0, found: 0, identified: 0 }; for (const f of ['gt', 'found', 'identified']) kinds[k][f] += v[f]; }
  const s = { scenes: sum(c => c.sim.scenes), gt: sum(c => c.sim.gt), found: sum(c => c.sim.found), falseDet: sum(c => c.sim.falseDet), err: sum(c => c.sim.err), idOk: sum(c => c.sim.idOk), idWrong: sum(c => c.sim.idWrong) };
  const r = { photos: sum(c => c.real.photos), rOk: sum(c => c.real.rOk), rDet: sum(c => c.real.rDet), rWrong: sum(c => c.real.rWrong) };
  const fo = { photos: sum(c => c.foreign?.photos || 0), accepted: sum(c => c.foreign?.accepted || 0) };
  const g = { photos: sum(c => c.grids.photos), gCards: sum(c => c.grids.gCards), gPresent: sum(c => c.grids.gPresent), gDet: sum(c => c.grids.gDet), gOk: sum(c => c.grids.gOk), gExtra: sum(c => c.grids.gExtra) };
  merged.models.push({
    model: m0.model, size: m0.size, bytes: m0.bytes, ms: {}, orientRetries: all.reduce((a, m) => a + (m.orientRetries || 0), 0),
    sim: s.scenes ? { scenes: s.scenes, cards: s.gt, detected: s.found / s.gt, falsePerScene: s.falseDet / s.scenes, cornerErrorPct: s.found ? (100 * s.err) / s.found : null, identified: s.idOk / s.gt, wrong: s.idWrong / s.gt,
      byKind: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, { cards: v.gt, detected: v.found / v.gt, identified: v.identified / v.gt }])) } : null,
    foreign: fo.photos ? fo : null,
    real: r.photos ? { photos: r.photos, detected: r.rDet / r.photos, identified: r.rOk / r.photos, wrong: r.rWrong / r.photos } : null,
    grids: g.photos ? { photos: g.photos, cards: g.gCards, detected: g.gDet / g.gPresent, identified: g.gOk / g.gCards, extraPerPhoto: g.gExtra / g.photos, perPhoto: all.flatMap(m => m.counts.grids.perPhoto).sort((a, b) => a.photo.localeCompare(b.photo)) } : null,
  });
});
fs.writeFileSync(report, JSON.stringify(merged, null, 2));
if (dump) fs.writeFileSync(path.resolve(root, dump), JSON.stringify(parts.flatMap((_, k) => JSON.parse(fs.readFileSync(path.join(tmp, `d${k}.json`), 'utf8')))));
fs.rmSync(tmp, { recursive: true, force: true });
for (const m of merged.models) {
  const n = (x, t) => Math.round(x * t);
  console.log(`${m.model} : ${m.sim ? `simulées ${n(m.sim.identified, m.sim.cards)}/${m.sim.cards} (fausses ${n(m.sim.wrong, m.sim.cards)})` : ''}${m.real ? ` · vraies ${n(m.real.identified, m.real.photos)}/${m.real.photos} (fausses ${n(m.real.wrong, m.real.photos)})` : ''}${m.grids ? ` · grilles ${n(m.grids.identified, m.grids.cards)}/${m.grids.cards}` : ''}${m.foreign ? ` · étrangères acceptées ${m.foreign.accepted}/${m.foreign.photos}` : ''}`);
}
console.log(`Rapport : ${report} (${Math.round((Date.now() - t0) / 1000)} s)`);
