/**
 * Test bench of the card recognition (« banc d'essai »).
 *
 *   npm run eval:matcher                 all cards, 3 simulated photos each
 *   npm run eval:matcher -- --aug 5      5 simulated photos per card
 *   npm run eval:matcher -- --sample 300 only 300 cards (faster)
 *
 * For each card image (public/cards/*.webp) it simulates photos taken with a
 * phone — rotation ±5°, slight perspective, crop shifted by a few %, brightness
 * ±30 %, white balance, blur, sleeve glare, JPEG, sensor noise — and computes
 * their fingerprint with EXACTLY the app's code (src/lib/fingerprint.js), then
 * matches them with the app's index (src/lib/matchIndex.js).
 *
 * Measures:
 *   - top-1 / top-5 accuracy (reprints with the same artwork = one class),
 *   - with the app's decision rule: accepted & right, accepted & WRONG, rejected,
 *   - out-of-catalog false positives (leave-one-out: the card and its reprints
 *     are removed from the base, the photo must be REJECTED).
 * Compares the old rule (raw cosine ≥ 0.80) with the current one, proposes
 * calibrated thresholds, writes model/eval-report.json.
 *
 * Real photos: model/real-photos/<card-id>/*.jpg (git-ignored), framed on the
 * card (portrait, little background), are added to the measures when present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryViews } from '../src/lib/fingerprint.js';
import { MatchIndex, DECISION, decodeFeatures, computeArtGroups } from '../src/lib/matchIndex.js';
import { mulberry32, simulatePhoto as simulateRaw, realPhoto } from './lib/simulate.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const AUG = arg('aug', 3);
const SAMPLE = arg('sample', 0);
const SEED = arg('seed', 42);
const OLD_THRESHOLD = 0.8;
// --geo / --light: strength of the geometric / light perturbations (1 = the
// full ranges: rotation ±5°, shift ±4 %, brightness ±30 %…; 0 = none).
// By default each photo gets a random strength in 0–1 (from clean to hard
// photos: clean photos are where unknown cards fool the matcher the most).
const GEO_ARG = arg('geo', NaN);
const LIGHT_ARG = arg('light', NaN);
const simulatePhoto = (file, r, range) => simulateRaw(file, r, range, { geo: GEO_ARG, light: LIGHT_ARG });

// ─── Catalog ─────────────────────────────────────────────────────────────
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public', 'card-hashes.json'), 'utf8'));
const cards = catalog.cards.map(c => ({ id: c.id, f: decodeFeatures(c.f), artBottom: c.artBottom, artGroup: c.artGroup }));
if (!cards.some(c => c.artGroup)) {
  const groups = computeArtGroups(cards);
  for (const c of cards) c.artGroup = groups.get(c.id);
}
const SCALES = (process.argv.includes('--scales') ? process.argv[process.argv.indexOf('--scales') + 1] : '').split(',').map(Number).filter(Boolean);
const index = new MatchIndex(cards, SCALES.length ? { scales: SCALES } : {});
console.log(`Échelles comparées : ${index.scales.join(', ')}`);
const groupOf = new Map(cards.map(c => [c.id, c.artGroup || c.id]));
const multi = [...index.groupSize.values()].filter(n => n > 1);
console.log(`Catalogue : ${cards.length} cartes, ${multi.length} groupes d'illustration identique (${multi.reduce((a, b) => a + b, 0)} cartes)`);

// ─── Other engines (AI models) / comparison: scripts/lib/engineBench.mjs ─
if (process.argv.includes('--compare') || (process.argv.includes('--engine') && process.argv[process.argv.indexOf('--engine') + 1] !== 'grid16')) {
  let list0 = cards.map(c => c.id);
  if (SAMPLE > 0 && SAMPLE < list0.length) {
    const r = mulberry32(SEED + 1);
    list0 = list0.map(id => [r(), id]).sort((a, b) => a[0] - b[0]).slice(0, SAMPLE).map(x => x[1]);
  }
  const { runEngineBench } = await import('./lib/engineBench.mjs');
  await runEngineBench({ root, argv: process.argv, cards, catalog, list: list0, AUG, SEED, GEO_ARG, LIGHT_ARG });
  process.exit(0);
}

// ─── Queries ─────────────────────────────────────────────────────────────
const rnd = mulberry32(SEED);
// --learn: the photos the user corrects and the later photos come from
// DIFFERENT conditions (other random series, other strength range), so the
// measured gain is not the simulator recognising itself.
const rndLater = mulberry32(SEED + 7919);
const LEARN_RANGE = [0, 0.6];
const LATER_RANGE = [0.3, 1];
let list = cards.map(c => c.id);
if (SAMPLE > 0 && SAMPLE < list.length) {
  const r = mulberry32(SEED + 1);
  list = list.map(id => [r(), id]).sort((a, b) => a[0] - b[0]).slice(0, SAMPLE).map(x => x[1]);
}
const queries = [];
// --learn: photo #0 of each card is « scanned » first; when the matcher is
// wrong or hesitates, the user's correction is learned (CardMatcher.setLearned);
// the next photos of the same card measure the gain.
const LEARN = process.argv.includes('--learn');
for (let k = 0; k < AUG; k++) for (const id of list) queries.push({ id, kind: 'simulée', k });
const realDir = path.join(root, 'model', 'real-photos');
if (fs.existsSync(realDir)) {
  for (const id of fs.readdirSync(realDir)) {
    if (!groupOf.has(id)) continue;
    for (const f of fs.readdirSync(path.join(realDir, id))) {
      if (/\.(jpe?g|png|webp)$/i.test(f)) queries.push({ id, kind: 'réelle', file: path.join(realDir, id, f) });
    }
  }
}
const nReal = queries.filter(q => q.kind === 'réelle').length;
console.log(`Requêtes : ${queries.length} (${list.length} cartes × ${AUG} photos simulées${nReal ? ` + ${nReal} photos réelles` : ''})\n`);

const VIEWS_OLD = new Set(['normal', 'flip', 'rot180']); // camera path before
const results = [];
const learned = [];
let skippedLearn = 0;
let learnedIndex = null;
const learnedResults = [];
const t0 = Date.now();
for (let qi = 0; qi < queries.length; qi++) {
  const q = queries[qi];
  const cardFile = path.join(root, 'public', 'cards', `${q.id}.webp`);
  const img = q.kind === 'réelle' ? await realPhoto(q.file)
    : LEARN ? await simulatePhoto(cardFile, q.k === 0 ? rnd : rndLater, q.k === 0 ? LEARN_RANGE : LATER_RANGE)
      : await simulatePhoto(cardFile, rnd);
  const views = queryViews(img.rgba, img.w, img.h, index.bottoms, index.grid);
  const g = groupOf.get(q.id);
  const k = 8 + (index.groupSize.get(g) || 1);
  const cen = index.rank(views, { k });
  const raw = index.rank(views.filter(v => VIEWS_OLD.has(v.name)), { mode: 'raw', k });
  const strip = (top) => top.filter(c => c.group !== g).slice(0, 8);
  if (LEARN && q.k === 0) {
    const d = index.decide(cen, DECISION);
    if (!(d.accepted && cen[0].group === g)) {
      const i = index.ids.indexOf(q.id);
      const card = cards[i];
      // Same guard as the app (learnSample): not learned when the photo looks
      // clearly more like another artwork than like the chosen card.
      if (index.learnable(views, i)) {
        learned.push({ id: card.id, f: index.bestView(views, i), artBottom: card.artBottom, artGroup: card.artGroup, learned: true });
      } else skippedLearn++;
    }
  }
  if (LEARN && q.k > 0) {
    if (!learnedIndex) {
      learnedIndex = new MatchIndex([...cards, ...learned], { mean: index.mean, learnedPenalty: arg('penalty', undefined) });
      console.log(`\n  ${learned.length} corrections apprises sur ${list.length} premières photos (${skippedLearn} refusées par le garde-fou)`);
    }
    const lt = learnedIndex.rank(views, { k: k + 8 });
    learnedResults.push({ id: q.id, group: g, cen: lt.slice(0, 12), cenLoo: lt.filter(c => c.group !== g).slice(0, 8) });
  }
  results.push({
    id: q.id, kind: q.kind, group: g, k: q.k,
    cen: cen.slice(0, 8), cenLoo: strip(cen),
    raw: raw.slice(0, 8), rawLoo: strip(raw),
  });
  if ((qi + 1) % 200 === 0) process.stdout.write(`  ${qi + 1}/${queries.length} (${Math.round((Date.now() - t0) / 1000)} s)\r`);
}
console.log(`\nAnalyse terminée en ${Math.round((Date.now() - t0) / 1000)} s\n`);

// ─── Measures ────────────────────────────────────────────────────────────
const pct = (x) => `${(100 * x).toFixed(1)} %`;
function topk(rs, key, k) {
  return rs.filter(r => {
    const seen = [];
    for (const c of r[key]) { if (!seen.includes(c.group)) seen.push(c.group); if (seen.length >= k) break; }
    return seen.includes(r.group);
  }).length / rs.length;
}
function oldRule(rs) {
  const inCat = rs.map(r => ({ ok: r.raw[0]?.score >= OLD_THRESHOLD, right: r.raw[0]?.group === r.group }));
  const loo = rs.map(r => r.rawLoo[0]?.score >= OLD_THRESHOLD);
  return summarize(inCat, loo);
}
function newRule(rs, t) {
  const inCat = rs.map(r => { const d = index.decide(r.cen, t); return { ok: d.accepted, right: r.cen[0]?.group === r.group }; });
  const loo = rs.map(r => index.decide(r.cenLoo, t).accepted);
  return summarize(inCat, loo);
}
function summarize(inCat, loo) {
  const n = inCat.length;
  return {
    acceptedRight: inCat.filter(x => x.ok && x.right).length / n,
    acceptedWrong: inCat.filter(x => x.ok && !x.right).length / n,
    rejected: inCat.filter(x => !x.ok).length / n,
    falsePositiveOutOfCatalog: loo.filter(Boolean).length / loo.length,
  };
}

// Calibration: best thresholds with ≤ 1 % out-of-catalog false positives and ≤ 1 % wrong cards.
const sim = results.filter(r => r.kind === 'simulée');
const grid = [];
for (let abs = 0.3; abs <= 0.9801; abs += 0.02) {
  for (let margin = 0; margin <= 0.6001; margin += 0.01) {
    grid.push({ abs: +abs.toFixed(2), margin: +margin.toFixed(2), s: newRule(sim, { ...DECISION, abs, margin }) });
  }
}
const bestFor = (fp) => grid
  .filter(g => g.s.falsePositiveOutOfCatalog <= fp && g.s.acceptedWrong <= 0.01)
  .sort((a, b) => b.s.acceptedRight - a.s.acceptedRight)[0] || null;
const tradeoff = [0.01, 0.02, 0.03, 0.05, 0.1].map(fp => ({ maxFalsePositive: fp, ...(bestFor(fp) || {}) }));
console.log('Compromis (faux positifs hors catalogue tolérés → meilleur réglage) :');
for (const t of tradeoff) {
  if (t.s) console.log(`  ≤ ${pct(t.maxFalsePositive).padStart(6)} : abs ${t.abs}, marge ${t.margin} → accepté juste ${pct(t.s.acceptedRight)}, accepté FAUX ${pct(t.s.acceptedWrong)}, faux positifs ${pct(t.s.falsePositiveOutOfCatalog)}`);
  else console.log(`  ≤ ${pct(t.maxFalsePositive).padStart(6)} : aucun réglage`);
}
const best = bestFor(0.01);
// « Sûr »: smallest lead where accepted answers are wrong less than 1 time in 500.
let sureMargin = null;
if (best) {
  for (let m = best.margin; m <= 0.5001; m += 0.01) {
    const acc = sim.filter(r => { const d = index.decide(r.cen, { ...DECISION, abs: best.abs, margin: m }); return d.accepted; });
    const wrong = acc.filter(r => r.cen[0].group !== r.group).length;
    if (acc.length && wrong / acc.length <= 0.002) { sureMargin = +m.toFixed(2); break; }
  }
}
// Temperature of the displayed probability: maximum likelihood of the right artwork.
function nll(T) {
  let s = 0;
  for (const r of sim) {
    const per = [];
    const seen = new Set();
    for (const c of r.cen) { if (!seen.has(c.group)) { seen.add(c.group); per.push(c); } }
    const mx = per[0].score;
    const z = per.reduce((a, c) => a + Math.exp((c.score - mx) / T), 0);
    const right = per.find(c => c.group === r.group);
    const p = right ? Math.exp((right.score - mx) / T) / z : 1e-4;
    s -= Math.log(Math.max(p, 1e-6));
  }
  return s / sim.length;
}
let temperature = DECISION.temperature;
let bestNll = Infinity;
for (let T = 0.005; T <= 0.2; T += 0.0025) { const v = nll(T); if (v < bestNll) { bestNll = v; temperature = +T.toFixed(4); } }

const report = {
  date: new Date().toISOString().slice(0, 10),
  queries: { total: results.length, simulated: sim.length, real: results.length - sim.length, cards: list.length, perCard: AUG, seed: SEED, geo: Number.isNaN(GEO_ARG) ? 'aléatoire 0–1' : GEO_ARG, light: Number.isNaN(LIGHT_ARG) ? 'aléatoire 0–1' : LIGHT_ARG },
  artGroups: multi.length,
  before: {
    rule: `cosinus brut ≥ ${OLD_THRESHOLD} (vues normale / miroir / 180°)`,
    top1: topk(sim, 'raw', 1), top5: topk(sim, 'raw', 5), ...oldRule(sim),
  },
  after: {
    rule: `centré + marge (abs ${DECISION.abs}, marge ${DECISION.margin}) — vues normale / miroir / 180° / 90°`,
    thresholds: DECISION, top1: topk(sim, 'cen', 1), top5: topk(sim, 'cen', 5), ...newRule(sim, DECISION),
  },
  tradeoff: tradeoff.map(t => ({ maxFalsePositive: t.maxFalsePositive, abs: t.abs, margin: t.margin, ...(t.s || {}) })),
  calibrated: best ? { abs: best.abs, margin: best.margin, sureMargin, temperature, ...best.s } : null,
};
if (results.length > sim.length) {
  const real = results.filter(r => r.kind === 'réelle');
  report.realPhotos = {
    before: { top1: topk(real, 'raw', 1), ...oldRule(real) },
    after: { top1: topk(real, 'cen', 1), ...newRule(real, DECISION) },
  };
}

// Out-of-catalog false positives: is the card found the same card under another printing?
const nameOf = new Map(catalog.cards.map(c => [c.id, c.name]));
{
  const fps = sim.filter(r => index.decide(r.cenLoo, DECISION).accepted);
  const same = fps.filter(r => nameOf.get(r.cenLoo[0].id) === nameOf.get(r.id));
  report.after.falsePositiveSameName = fps.length ? same.length / fps.length : 0;
  report.after.falsePositiveExamples = fps.slice(0, 12).map(r => `${r.id} (${nameOf.get(r.id)}) → ${r.cenLoo[0].id} (${nameOf.get(r.cenLoo[0].id)}) ${r.cenLoo[0].score.toFixed(2)}`);
}
const row = (label, m) => console.log(`${label.padEnd(34)} top-1 ${pct(m.top1).padStart(7)}  top-5 ${pct(m.top5).padStart(7)}  accepté juste ${pct(m.acceptedRight).padStart(7)}  accepté FAUX ${pct(m.acceptedWrong).padStart(6)}  rejeté ${pct(m.rejected).padStart(7)}  faux positifs hors catalogue ${pct(m.falsePositiveOutOfCatalog).padStart(7)}`);
row('Avant (cosinus brut ≥ 0,80)', report.before);
row('Après (seuils actuels)', report.after);
if (report.calibrated) {
  const c = report.calibrated;
  console.log(`\nSeuils proposés : abs ${c.abs}, marge ${c.margin}, « Sûr » dès ${c.sureMargin}, température ${c.temperature}`);
  console.log(`  → accepté juste ${pct(c.acceptedRight)}, accepté FAUX ${pct(c.acceptedWrong)}, faux positifs hors catalogue ${pct(c.falsePositiveOutOfCatalog)}`);
} else {
  console.log('\nAucun réglage ne tient ≤ 1 % de faux positifs : voir le rapport.');
}
if (LEARN && learnedResults.length) {
  const later = results.filter(r => r.k > 0);
  const evalWith = (rs, idx) => {
    const inCat = rs.map(r => { const d = idx.decide(r.cen, DECISION); return { ok: d.accepted, right: r.cen[0]?.group === r.group }; });
    const loo = rs.map(r => idx.decide(r.cenLoo, DECISION).accepted);
    return { top1: topk(rs, 'cen', 1), top5: topk(rs, 'cen', 5), ...summarize(inCat, loo) };
  };
  report.learning = {
    learned: learned.length, refused: skippedLearn, penalty: learnedIndex.penalty.find(x => x > 0) ?? null,
    note: 'photos corrigées et photos suivantes simulées dans des conditions différentes ; décision par défaut (Prudent)',
    without: evalWith(later, index), with: evalWith(learnedResults, learnedIndex),
  };
  console.log('\nPhotos suivantes des mêmes cartes :');
  row('Sans apprentissage', report.learning.without);
  row('Avec les corrections apprises', report.learning.with);
}

// --try "abs:marge,abs:marge" : compare other thresholds on the same photos.
const tryArg = process.argv.includes('--try') ? process.argv[process.argv.indexOf('--try') + 1] : '';
for (const pair of tryArg.split(',').filter(Boolean)) {
  const [abs, margin] = pair.split(':').map(Number);
  row(`Essai abs ${abs} marge ${margin}`, { top1: report.after.top1, top5: report.after.top5, ...newRule(sim, { ...DECISION, abs, margin }) });
}
if (report.realPhotos) {
  // Real photos are always reported apart: never mixed with simulated ones.
  console.log('\nPhotos RÉELLES (model/real-photos) :');
  row('Réelles — avant', { top5: NaN, ...report.realPhotos.before });
  row('Réelles — après', { top5: NaN, ...report.realPhotos.after });
} else console.log('\nPhotos réelles : aucune (déposez-les dans model/real-photos/<id-carte>/).');
fs.writeFileSync(path.join(root, 'model', 'eval-report.json'), JSON.stringify(report, null, 2));
console.log('\nRapport : model/eval-report.json');
