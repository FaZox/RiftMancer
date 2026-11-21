/**
 * Report of scripts/eval-recognition.mjs runs: each mode's thresholds
 * recalibrated on the simulated cards (out-of-catalog accepted ≤ 1 %, wrong ≤ 0.5 %,
 * most right answers), then applied to every set.
 *
 *   node scripts/recognition-report.mjs label=rec.json[,more.json] … [--groups groupes.json] [--sleeves pochettes.json] [--fixed]
 *   --fixed: no recalibration, the app's thresholds (colours 0.44 / 0.11, fused 0.36 / 0.13)
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const get = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const runs = argv.filter((a, i) => a.includes('=') && !argv[i - 1]?.startsWith('--')).map((a) => { const [label, files] = a.split('='); return { label, rows: files.split(',').flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8'))) }; });
const groups = get('groups', '') ? JSON.parse(fs.readFileSync(get('groups'), 'utf8')) : {};
const sleeves = get('sleeves', '') ? JSON.parse(fs.readFileSync(get('sleeves'), 'utf8')) : {};
const MODES = (get('modes', 'colours,ai,cascade,A,Aai,B')).split(',');
const FP = Number(get('fp', 0.01)); const WRONG = Number(get('wrong', 0.005));
const FIXED = argv.includes('--fixed');
// --min-abs 0.4: a minimum score (the out-of-catalog limit alone can leave abs = 0)
const MIN_ABS = Number(get('min-abs', 0));

const acc = (d, t) => !!d && d.g != null && (d.p === 'c' || (d.s1 >= t.abs && d.s1 - d.s2 >= t.margin));
function calibrate(sim, mode) {
  if (FIXED) return mode === 'colours' ? { abs: 0.44, margin: 0.11 } : { abs: 0.36, margin: 0.13 };
  let best = null;
  for (let a = MIN_ABS; a <= 1.0001; a += 0.005) for (let m = 0; m <= 0.4001; m += 0.005) {
    const t = { abs: +a.toFixed(3), margin: +m.toFixed(3) };
    let right = 0; let wrong = 0; let fp = 0; let n = 0; let nl = 0;
    for (const x of sim) { const d = x.cat?.[mode]; if (!d) continue; n++; if (acc(d, t)) { if (d.g === x.truth) right++; else wrong++; } const l = x.loo?.[mode]; if (l) { nl++; if (acc(l, t)) fp++; } }
    if (fp / nl <= FP && wrong / n <= WRONG && (!best || right > best.right)) best = { ...t, right, wrong, fp: fp / nl, n };
  }
  return best;
}
const serie = (p) => { const t = +p.slice(9, 13); return t < 1128 ? 's1' : t < 1132 ? 's2' : t < 1136 ? 's3' : t < 1139 ? 's4' : 's5'; };

for (const run of runs) {
  const rows = run.rows.filter((x) => !x.timing && !x.jitter);
  const timing = run.rows.filter((x) => x.timing).map((x) => x.timing);
  const sim = rows.filter((x) => x.kind === 'sim');
  const real = rows.filter((x) => x.kind === 'real' && !/^2026111[5]/.test(x.photo));
  const series = rows.filter((x) => x.kind === 'real' && /^20261115/.test(x.photo));
  const grids = rows.filter((x) => x.kind === 'grid');
  const foreign = rows.filter((x) => x.kind === 'foreign');
  console.log(`\n## ${run.label}  (simulées ${sim.length}, vraies ${new Set(real.map((x) => x.photo)).size}, grilles ${grids.length} cadres, séries ${new Set(series.map((x) => x.photo)).size})`);
  if (timing.length) { const t = timing[0]; console.log(`temps (processeur, ${t.cores || '?'} cœurs) : couleurs ${t.colourMs.toFixed(0)} ms, découpe ${t.cropMs.toFixed(0)} ms, IA 1 découpage ${t.embedSingleMs.toFixed(0)} ms, IA 3 découpages × 2 sens ${t.embedFullMs.toFixed(0)} ms`); }
  console.log('| mode | seuils | simulées justes / fausses / hors cat. | vraies (top-1) | coin dehors / bord / visibles | pochette sans / bleue / rouge | grilles 0° / 90° / 180° / 270° (top-1 0°) | séries 1-5 (top-1) | étrangères acceptées | IA utilisée |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const mode of MODES) {
    if (!sim.some((x) => x.cat?.[mode])) continue;
    const t = calibrate(sim, mode); if (!t) { console.log(`| ${mode} | aucun réglage ne tient |`); continue; }
    let sr = 0; let sw = 0; let sf = 0; let nl = 0;
    for (const x of sim) { const d = x.cat[mode]; if (acc(d, t)) { if (d.g === x.truth) sr++; else sw++; } if (x.loo?.[mode]) { nl++; if (acc(x.loo[mode], t)) sf++; } }
    // single-card photos: right if any detection of the photo is accepted with the true artwork
    const perPhoto = (L) => { const ok = {}; const t1 = {}; for (const x of L) { const d = x.cat[mode]; if (!d) continue; ok[x.photo] ||= acc(d, t) && d.g === x.truth; t1[x.photo] ||= d.g === x.truth; } return { ok, t1 }; };
    const R = perPhoto(real); const nOk = Object.values(R.ok).filter(Boolean).length; const nT1 = Object.values(R.t1).filter(Boolean).length;
    const cnt = (map, key) => { const L = Object.keys(R.ok).filter((p) => map[p] === key); return `${L.filter((p) => R.ok[p]).length}/${L.length}`; };
    const g = (rot) => { const L = grids.filter((x) => x.rot === rot); return { ok: L.filter((x) => acc(x.cat[mode], t) && x.list?.includes(x.cat[mode].g)).length, t1: L.filter((x) => x.list?.includes(x.cat[mode].g)).length, n: L.length }; };
    const g0 = g(0);
    const SR = perPhoto(series); const bySer = {}; for (const p of Object.keys(SR.ok)) { const s = serie(p); bySer[s] ||= [0, 0]; if (SR.ok[p]) bySer[s][0]++; if (SR.t1[p]) bySer[s][1]++; }
    const fAcc = {}; for (const x of foreign) { const d = x.cat?.[mode]; if (d) fAcc[x.photo] ||= acc(d, t); }
    const fTxt = foreign.length ? `${Object.values(fAcc).filter(Boolean).length}/${Object.keys(fAcc).length}` : '—';
    const aiShare = rows.filter((x) => x.cat?.[mode]).length ? rows.filter((x) => x.cat?.[mode]?.p === 'f').length / rows.filter((x) => x.cat?.[mode]).length : 0;
    console.log(`| ${mode} | ${t.abs} / ${t.margin} | ${sr} / ${sw} / ${(100 * sf / nl).toFixed(2)} % | ${nOk} (${nT1}) | ${cnt(groups, 'dehors')} · ${cnt(groups, 'bord')} · ${cnt(groups, 'visibles')} | ${cnt(sleeves, 'sans')} · ${cnt(sleeves, 'bleue')} · ${cnt(sleeves, 'rouge')} | ${g0.ok} / ${g(90).ok} / ${g(180).ok} / ${g(270).ok} (${g0.t1}) | ${['s1', 's2', 's3', 's4', 's5'].map((s) => (bySer[s] ? `${bySer[s][0]}` : '—')).join(' · ')} (${['s1', 's2', 's3', 's4', 's5'].map((s) => (bySer[s] ? bySer[s][1] : '—')).join(' · ')}) | ${fTxt} | ${mode === 'colours' ? '—' : `${(100 * aiShare).toFixed(0)} %`} |`);
  }
}

// --jitter rows: sensitivity curve (real photos + series), top-1 and accepted with the app's thresholds
const jit = runs.flatMap((r) => r.rows.filter((x) => !x.timing && x.jitter != null && x.kind === 'real').map((x) => ({ ...x, run: r.label })));
if (jit.some((x) => x.jitter)) {
  console.log('\n## Sensibilité (vraies photos + séries ; acceptées avec les seuils de l\'appli : couleurs 0,44 / 0,11, IA et cascade 0,36 / 0,13)');
  for (const run of [...new Set(jit.map((x) => x.run))]) {
    console.log(`\n${run}\n| décalage | couleurs top-1 / acceptées | IA top-1 / acceptées | cascade top-1 / acceptées | A top-1 / acceptées |\n|---|---|---|---|---|`);
    for (const j of [...new Set(jit.map((x) => x.jitter))].sort((a, b) => a - b)) {
      const L = jit.filter((x) => x.run === run && x.jitter === j);
      const cell = (mode) => { const t = mode === 'colours' ? { abs: 0.44, margin: 0.11 } : { abs: 0.36, margin: 0.13 }; const ok = {}; const t1 = {}; for (const x of L) { const d = x.cat[mode]; t1[x.photo] ||= d.g === x.truth; ok[x.photo] ||= acc(d, t) && d.g === x.truth; } return `${Object.values(t1).filter(Boolean).length} / ${Object.values(ok).filter(Boolean).length}`; };
      console.log(`| ${(100 * j).toFixed(0)} % | ${cell('colours')} | ${cell('ai')} | ${cell('cascade')} | ${cell('A')} |`);
    }
  }
}
