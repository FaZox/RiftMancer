/**
 * Comparison of recognition engines on the same photos (AMELIORATIONS-MODELES.md, step 1.2 / 2).
 *
 *   npm run eval:matcher -- --compare grid16,dinov2s@full,dinov2s@art --sample 300 --aug 2
 *   npm run eval:matcher -- --engine dinov2s --region full
 *   … --fusion 0.5,0.7,0.85     score = α·engine + (1 − α)·grid16
 *   … --cascade 30[,150]        + the app's way (step 4.6): colours first; only
 *                               when they hesitate, the AI on the colours' best
 *                               orientation and the crops of their 30 best cards
 *
 * Each config is « engine@region » (region: art = illustration only, full =
 * whole card). Catalog vectors are cached in model/cache/. For every config:
 * thresholds calibrated for ≤ 1 % cards absent from the catalog accepted and
 * ≤ 0.5 % wrong cards accepted, then: top-1, top-5, accepted right / wrong,
 * rejected, out-of-catalog accepted, same-name reprint confusions, ms per card
 * (Node, CPU), model size. Simulated and real photos are never mixed.
 * Report: model/eval-compare.json.
 */
import { tuneOrt } from './benchOrt.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { MatchIndex, DECISION } from '../../src/lib/matchIndex.js';
import { grid16 } from '../../src/lib/engines/grid16.js';
import { createOnnxEngine, ENGINE_CONFIGS } from '../../src/lib/engines/onnxEngine.js';
import { mulberry32, simulatePhoto, realPhoto } from './simulate.mjs';
import { barColour, barReference, frameCheck } from './frameCheck.mjs';
import { alignedSignature, alignedScore, pickAlignedWinner, DEFAULT_ALIGNED_OPTIONS, encodeSignature, decodeSignature } from '../../src/lib/alignedVerify.js';

const pct = (x) => (x == null || Number.isNaN(x) ? '   —  ' : `${(100 * x).toFixed(1).padStart(5)} %`);

async function loadEngine(root, id) {
  if (id === 'grid16') return grid16;
  const cfg = ENGINE_CONFIGS[id];
  if (!cfg) throw new Error(`Moteur inconnu : ${id} (connus : grid16, ${Object.keys(ENGINE_CONFIGS).join(', ')})`);
  const file = path.join(root, 'model', 'embedders', cfg.file);
  if (!fs.existsSync(file)) throw new Error(`Modèle absent : ${file} (voir model/MODELS.md)`);
  const ort = { ...(await import('onnxruntime-node')) };
  tuneOrt(ort);
  const engine = createOnnxEngine(id, cfg);
  await engine.init({ ort, model: file, executionProviders: ['cpu'] });
  engine.size = fs.statSync(file).size;
  engine.sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return engine;
}

async function cardPixels(root, id) {
  const { data, info } = await sharp(path.join(root, 'public', 'cards', `${id}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: data, w: info.width, h: info.height };
}

/** Catalog vectors of a config (cached in model/cache/). */
async function catalogVectors(root, engine, region, cards) {
  if (engine.id === 'grid16') return cards.map(c => c.f);
  const dir = path.join(root, 'model', 'cache');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${engine.id}-${region}-${engine.sha.slice(0, 12)}.json`);
  if (fs.existsSync(file)) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j.count === cards.length) {
      const all = new Float32Array(Buffer.from(j.data, 'base64').buffer.slice(0));
      return cards.map((_, i) => all.subarray(i * j.dim, (i + 1) * j.dim));
    }
  }
  const out = [];
  const t0 = Date.now();
  for (let i = 0; i < cards.length; i++) {
    const { rgba, w, h } = await cardPixels(root, cards[i].id);
    out.push(await engine.embedCatalog(rgba, w, h, { region, bottom: cards[i].artBottom }));
    if ((i + 1) % 200 === 0) process.stdout.write(`  catalogue ${engine.id}@${region} : ${i + 1}/${cards.length} (${Math.round((Date.now() - t0) / 1000)} s)\r`);
  }
  const dim = out[0].length;
  const all = new Float32Array(cards.length * dim);
  out.forEach((v, i) => all.set(v, i * dim));
  fs.writeFileSync(file, JSON.stringify({ engine: engine.id, region, modelSha256: engine.sha, dim, count: cards.length, data: Buffer.from(all.buffer).toString('base64') }));
  return out;
}

/** 40 × 56 pixel signatures of the catalog's pictures (phase A, cached in model/cache/). */
async function alignedReferences(root, cards) {
  const dir = path.join(root, 'model', 'cache');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `aligned-${cards.length}.json`);
  if (fs.existsSync(file)) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j.ids?.length === cards.length && j.ids.every((id, i) => id === cards[i].id)) return j.sigs.map(decodeSignature);
  }
  const sigs = [];
  for (const c of cards) {
    const { rgba, w, h } = await cardPixels(root, c.id);
    sigs.push(alignedSignature(rgba, w, h));
  }
  fs.writeFileSync(file, JSON.stringify({ ids: cards.map(c => c.id), sigs: sigs.map(encodeSignature) }));
  return sigs;
}

/**
 * Pixel check (--verify K): the K first artworks of the list (with their
 * reprints) scored against the photo, both ways up; decision by
 * pickAlignedWinner. → { winner, refused, inList }
 */
let VERIFY = null; // { Ks, refs, opts: [{ minScore, minMargin }], ms, n }
function verifyList(list, qsig, K, opts) {
  const groupsSeen = [];
  const scores = [];
  for (const c of list) {
    if (!groupsSeen.includes(c.group)) { if (groupsSeen.length >= K) continue; groupsSeen.push(c.group); }
    const ref = VERIFY.refs[c.index];
    if (!ref) continue;
    let s = alignedScore(qsig[0], ref);
    const s2 = alignedScore(qsig[1], ref);
    if (!(s >= s2)) s = Number.isFinite(s2) ? s2 : s;
    scores.push({ key: c.index, group: c.group, score: s });
  }
  const g = new Map(scores.map(e => [e.key, e.group]));
  return { ...pickAlignedWinner(scores, (k) => g.get(k), opts), groups: groupsSeen };
}
const c0Rows = (all, rk) => all.some(c => c.rows?.[rk]?.length);
function verifyMeasure(rows, K, opts) {
  const n = rows.length;
  if (!n) return null;
  let right = 0; let wrong = 0; let refused = 0; let fp = 0; let inList = 0;
  const wrongs = [];
  for (const r of rows) {
    const d = verifyList(r.top, r.qsig, K, opts);
    if (d.groups.includes(r.group)) inList++;
    if (d.winner) { if (d.winner.group === r.group || r.top.find(c => c.index === d.winner.key)?.group === r.group) right++; else { wrong++; wrongs.push(`${r.id}→${r.top.find(c => c.index === d.winner.key)?.id} (${d.winner.score.toFixed(2)} / ${d.winner.rival.toFixed(2)})`); } }
    else if (d.refused) refused++;
    if (verifyList(r.loo, r.qsig, K, opts).winner) fp++;
  }
  return { n, inList: inList / n, acceptedRight: right / n, acceptedWrong: wrong / n, refused: refused / n, rejected: 1 - (right + wrong) / n, falsePositiveOutOfCatalog: fp / n, wrongs };
}

/**
 * The app's decision (thresholds t) combined with the pixel check:
 *   veto   — accepted by the app, but the check picks ANOTHER artwork → asked;
 *   rescue — refused by the app, the check picks the app's 1st artwork → accepted.
 */
function combinedMeasure(rows, index, t, K, opts) {
  const n = rows.length;
  if (!n) return null;
  const out = {};
  for (const mode of ['app', 'veto', 'veto+rescue', 'rescue']) out[mode] = { right: 0, wrong: 0, fp: 0, wrongs: [] };
  const decideOne = (list, forced, qsig) => {
    const app = forced || (list.length && index.decide(list, t).accepted);
    const v = verifyList(list, qsig, K, opts);
    const first = list[0]?.group;
    const agree = !!v.winner && v.winner.art === first;
    const contra = !!v.winner && v.winner.art !== first;
    return {
      app: app ? first : null,
      veto: app && !contra ? first : null,
      'veto+rescue': (app && !contra) || (!app && agree) ? first : null,
      rescue: app || agree ? first : null,
    };
  };
  for (const r of rows) {
    const a = decideOne(r.top, r.forced, r.qsig);
    const b = decideOne(r.loo, r.looForced, r.qsig);
    for (const mode of Object.keys(out)) {
      if (a[mode] != null) { if (a[mode] === r.group) out[mode].right++; else { out[mode].wrong++; out[mode].wrongs.push(`${r.id}→${r.top[0]?.id}`); } }
      if (b[mode] != null) out[mode].fp++;
    }
  }
  for (const m of Object.values(out)) { m.acceptedRight = m.right / n; m.acceptedWrong = m.wrong / n; m.falsePositiveOutOfCatalog = m.fp / n; }
  return out;
}

function topFromScores(scores, ids, group, k, exclude) {
  const top = [];
  for (let i = 0; i < scores.length; i++) {
    if (exclude && exclude(i)) continue;
    const s = scores[i];
    if (top.length < k || s > top[top.length - 1].score) {
      let p = top.length < k ? top.length : k - 1;
      if (top.length < k) top.push(null);
      while (p > 0 && top[p - 1].score < s) { top[p] = top[p - 1]; p--; }
      top[p] = { index: i, id: ids[i], group: group[i], score: s };
    }
  }
  return top;
}

// Frame check (step 5.1, --frame-check [tolerance]): catalog name-bar colour of every card
let FRAME = null; // { refs: [bar | null] by card index, tol }
const frameConflict = (r, cand) => FRAME && cand && frameCheck(r.bar, FRAME.refs[cand.index], FRAME.tol) === 'conflict';

function measure(rows, index, t, nameOf, frame = false) {
  const n = rows.length;
  if (!n) return null;
  let right = 0; let wrong = 0; let fp = 0; let top1 = 0; let top5 = 0; let reprintAsked = 0; let reprintConf = 0;
  for (const r of rows) {
    // Cascade: accepted by the colours alone (r.forced), else by the fused score.
    let d = r.forced ? { accepted: true } : index.decide(r.top, t);
    if (frame && d.accepted && frameConflict(r, r.top[0])) d = { accepted: false };
    const ok = r.top[0]?.group === r.group;
    if (ok) top1++;
    const seen = [];
    for (const c of r.top) { if (!seen.includes(c.group)) seen.push(c.group); if (seen.length >= 5) break; }
    if (seen.includes(r.group)) top5++;
    if (d.accepted && ok) right++;
    if (d.accepted && !ok) wrong++;
    if ((r.looForced || index.decide(r.loo, t).accepted) && !(frame && frameConflict(r, r.loo[0]))) fp++;
    // Same-name reprints (other artwork): confused?
    if (r.sameNameOthers) {
      reprintAsked++;
      if (!ok && nameOf(r.top[0]?.id) === nameOf(r.id)) reprintConf++;
    }
  }
  return {
    n, top1: top1 / n, top5: top5 / n, acceptedRight: right / n, acceptedWrong: wrong / n,
    rejected: 1 - (right + wrong) / n, falsePositiveOutOfCatalog: fp / n,
    reprintConfusion: reprintAsked ? reprintConf / reprintAsked : null,
  };
}

/**
 * Best thresholds (most accepted-right) within the limits: Prudent = ≤ 1 % out of
 * catalog and ≤ 0.5 % wrong; « Rapide » (FAST_LIMITS) accepts more risk.
 */
// --limit-fp X: a stricter limit of out-of-catalog cards accepted (e.g. the current model's own rate)
const PRUDENT_LIMITS = { fp: 0.01, wrong: 0.005 };
let checkCalibration = false;
const FAST_LIMITS = { fp: 0.1, wrong: 0.02 };

// Same search, fast: whether a card is accepted depends only on its score and
// margin, computed ONCE per photo; the 3 660 threshold pairs then cost a few
// comparisons each (was: every decision recomputed for each pair, ~1 h for a
// big comparison on one core). Same result as calibrateSlow (--check-calibration).
function calibrate(rows, index, limits = PRUDENT_LIMITS, frame = false) {
  const n = rows.length;
  const S = new Float64Array(n); const M = new Float64Array(n); const kind = new Uint8Array(n); // 0 never, 1 forced, 2 thresholds
  const LS = new Float64Array(n); const LM = new Float64Array(n); const lkind = new Uint8Array(n);
  const ok = new Uint8Array(n);
  rows.forEach((r, i) => {
    ok[i] = r.top[0]?.group === r.group ? 1 : 0;
    if (r.forced) kind[i] = 1;
    else if (r.top.length) { const d = index.decide(r.top, DECISION); S[i] = d.score; M[i] = d.margin; kind[i] = 2; }
    if (frame && frameConflict(r, r.top[0])) kind[i] = 0;
    if (r.looForced) lkind[i] = 1;
    else if (r.loo.length) { const d = index.decide(r.loo, DECISION); LS[i] = d.score; LM[i] = d.margin; lkind[i] = 2; }
    if (frame && frameConflict(r, r.loo[0])) lkind[i] = 0;
  });
  let best = null;
  for (let abs = -0.2; abs <= 0.9801; abs += 0.02) {
    for (let margin = 0; margin <= 0.6001; margin += 0.01) {
      const t = { ...DECISION, abs: +abs.toFixed(2), margin: +margin.toFixed(2) };
      let right = 0; let wrong = 0; let fp = 0;
      for (let i = 0; i < n; i++) {
        if (kind[i] === 1 || (kind[i] === 2 && S[i] >= t.abs && M[i] >= t.margin)) { if (ok[i]) right++; else wrong++; }
        if (lkind[i] === 1 || (lkind[i] === 2 && LS[i] >= t.abs && LM[i] >= t.margin)) fp++;
      }
      if (fp / n <= limits.fp && wrong / n <= limits.wrong && (!best || right > best.right)) best = { t, right };
    }
  }
  return best ? { t: best.t, m: measure(rows, index, best.t, () => null, frame) } : null;
}

function calibrateSlow(rows, index, limits = PRUDENT_LIMITS, frame = false) {
  let best = null;
  for (let abs = -0.2; abs <= 0.9801; abs += 0.02) {
    for (let margin = 0; margin <= 0.6001; margin += 0.01) {
      const t = { ...DECISION, abs: +abs.toFixed(2), margin: +margin.toFixed(2) };
      const m = measure(rows, index, t, () => null, frame);
      if (m.falsePositiveOutOfCatalog <= limits.fp && m.acceptedWrong <= limits.wrong && (!best || m.acceptedRight > best.m.acceptedRight)) best = { t, m };
    }
  }
  return best;
}

export async function runEngineBench({ root, argv, cards, catalog, list, AUG, SEED, GEO_ARG, LIGHT_ARG }) {
  const get = (name) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : null);
  const spec = get('compare') || `${get('engine') || 'grid16'}@${get('region') || 'full'}`;
  const configs = [];
  for (const item of spec.split(',').map(s => s.trim()).filter(Boolean)) {
    const [id, region] = item.split('@');
    const regions = region ? [region] : id === 'grid16' ? ['art'] : ['art', 'full'];
    for (const r of regions) configs.push({ id, region: r, key: `${id}@${r}` });
  }
  if (!configs.some(c => c.id === 'grid16')) configs.unshift({ id: 'grid16', region: 'art', key: 'grid16@art' });
  const fusions = (get('fusion') || '').split(',').map(Number).filter(x => x > 0 && x < 1);

  console.log(`Moteurs : ${configs.map(c => c.key).join(', ')}${fusions.length ? ` · fusion α = ${fusions.join(', ')}` : ''}`);
  const engines = new Map();
  for (const c of configs) {
    if (!engines.has(c.id)) engines.set(c.id, await loadEngine(root, c.id));
    const engine = engines.get(c.id);
    const vecs = await catalogVectors(root, engine, c.region, cards);
    const entries = cards.map((card, i) => ({
      id: card.id, f: vecs[i], artGroup: card.artGroup,
      artBottom: c.region === 'full' ? 1 : card.artBottom,
    }));
    c.engine = engine;
    c.index = new MatchIndex(entries, engine.id === 'grid16' ? {} : { generic: true });
    c.rows = { sim: [], real: [] };
    c.ms = 0;
    console.log(`  ${c.key} : vecteurs de ${c.index.rawDim} valeurs, modèle ${engine.size ? `${(engine.size / 1e6).toFixed(1)} Mo` : '—'}`);
  }
  const gridCfg = configs.find(c => c.id === 'grid16');
  const fusionCfgs = [];
  for (const c of configs) {
    if (c.id === 'grid16') continue;
    for (const a of fusions) fusionCfgs.push({ key: `${c.key}+grid16 α${a}`, base: c, alpha: a, rows: { sim: [], real: [] }, index: c.index });
  }
  if (get('limit-fp')) PRUDENT_LIMITS.fp = Number(get('limit-fp'));
  if (argv.includes('--check-calibration')) checkCalibration = true;
  if (argv.includes('--frame-check')) {
    const tol = Number(get('frame-check')) || 50;
    const refs = [];
    for (const c of cards) {
      const { rgba, w, h } = await realPhoto(path.join(root, 'public', 'cards', `${c.id}.webp`));
      refs.push(barReference(rgba, w, h, c));
    }
    FRAME = { refs, tol };
    console.log(`Contrôle du cadre (5.1) : ${refs.filter(Boolean).length} cartes vérifiables sur ${cards.length}, tolérance ${tol}°`);
  }
  if (argv.includes('--verify')) {
    const Ks = (get('verify') || '8').split(',').map(Number).filter(k => k > 0);
    // --verify-opts 0.6/0.15,0.55/0.1 : other thresholds measured too
    const opts = [DEFAULT_ALIGNED_OPTIONS, ...(get('verify-opts') || '').split(',').filter(Boolean).map(s => { const [a, b] = s.split('/').map(Number); return { minScore: a, minMargin: b }; })];
    const t = Date.now();
    VERIFY = { Ks, opts, refs: await alignedReferences(root, cards), ms: 0, n: 0 };
    console.log(`Vérification par pixels (phase A) : K = ${Ks.join(', ')}, ${VERIFY.refs.length} signatures (${Math.round((Date.now() - t) / 1000)} s)`);
  }
  const cascadeKs = (get('cascade') || '').split(',').map(Number).filter(k => k > 0);
  // --single: the AI sees only one crop (the colours' best card's), one orientation
  const singles = argv.includes('--single') ? [false, true] : [false];
  // --agree: each cascade config also with « colours + AI agreement » — when
  // the colours are sure, the AI must rank the same artwork first among their
  // K best cards, otherwise the fused score decides (no-card pictures).
  const agrees = argv.includes('--agree') ? [false, true] : [false];
  const cascadeCfgs = cascadeKs.flatMap(K => singles.flatMap(single => agrees.flatMap(agree => fusionCfgs.map(f => ({ key: `${f.key} cascade${K}${single ? ' 1img' : ''}${agree ? ' +accord' : ''}`, base: f.base, alpha: f.alpha, K, single, agree, rows: { sim: [], real: [] }, index: f.index, aiQueries: 0, aiImages: 0 })))));

  const nameOf = new Map(catalog.cards.map(c => [c.id, String(c.name || '').toLowerCase()]));
  const sameNameCount = new Map();
  for (const c of catalog.cards) {
    const k = nameOf.get(c.id);
    sameNameCount.set(k, (sameNameCount.get(k) || 0) + 1);
  }
  const ids = cards.map(c => c.id);
  const groups = cards.map(c => c.artGroup || c.id);

  const queries = [];
  for (let k = 0; k < AUG; k++) for (const id of list) queries.push({ id, kind: 'sim' });
  const realDir = path.join(root, 'model', 'real-photos');
  if (fs.existsSync(realDir)) {
    for (const id of fs.readdirSync(realDir)) {
      if (!ids.includes(id)) continue;
      for (const f of fs.readdirSync(path.join(realDir, id))) if (/\.(jpe?g|png|webp)$/i.test(f)) queries.push({ id, kind: 'real', file: path.join(realDir, id, f) });
    }
  }
  const rnd = mulberry32(SEED);
  const t0 = Date.now();
  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi];
    const img = q.kind === 'real' ? await realPhoto(q.file)
      : await simulatePhoto(path.join(root, 'public', 'cards', `${q.id}.webp`), rnd, [0, 1], { geo: GEO_ARG, light: LIGHT_ARG });
    const g = groups[ids.indexOf(q.id)];
    const exclude = (i) => groups[i] === g;
    const bar = FRAME ? barColour(img.rgba, img.w, img.h) : null;
    const sameNameOthers = sameNameCount.get(nameOf.get(q.id)) > 1;
    const qsig = VERIFY ? [alignedSignature(img.rgba, img.w, img.h, 0), alignedSignature(img.rgba, img.w, img.h, 2)] : null;
    const scoresOf = new Map();
    const viewsOf = new Map();
    for (const c of configs) {
      const t1 = performance.now();
      const views = await c.engine.embed(img.rgba, img.w, img.h, { region: c.region, bottoms: c.index.bottoms });
      const scores = c.index.scoreAll(views);
      c.ms += performance.now() - t1;
      scoresOf.set(c.key, scores);
      viewsOf.set(c.key, views);
      c.rows[q.kind].push({ id: q.id, group: g, sameNameOthers, qsig, top: topFromScores(scores, ids, groups, 12), loo: topFromScores(scores, ids, groups, 8, exclude) });
    }
    for (const f of fusionCfgs) {
      const se = scoresOf.get(f.base.key);
      const sg = scoresOf.get(gridCfg.key);
      const s = new Float32Array(se.length);
      for (let i = 0; i < s.length; i++) s[i] = f.alpha * se[i] + (1 - f.alpha) * sg[i];
      f.rows[q.kind].push({ id: q.id, group: g, sameNameOthers, qsig, top: topFromScores(s, ids, groups, 12), loo: topFromScores(s, ids, groups, 8, exclude) });
    }
    for (const f of cascadeCfgs) {
      const sg = scoresOf.get(gridCfg.key);
      const gv = viewsOf.get(gridCfg.key);
      const av = viewsOf.get(f.base.key);
      const run = (excl) => {
        const gtop = topFromScores(sg, ids, groups, f.K, excl);
        const sure = gridCfg.index.decide(gtop.slice(0, 12), DECISION).accepted;
        if (sure && !f.agree) return { forced: true, top: gtop.slice(0, 12), images: 0 };
        const o = gridCfg.index.bestViewName(gv, gtop[0].index) === 'rot180' ? 'rot180' : 'normal';
        const bottoms = new Set(f.single ? [f.base.index.bottom[gtop[0].index]] : gtop.map(c => f.base.index.bottom[c.index]));
        const fv = av.filter(v => v.name === o).map(v => ({ name: v.name, byBottom: new Map([...v.byBottom].filter(([b]) => bottoms.has(b))) }));
        const se = f.base.index.scoreAll(fv);
        if (sure) {
          // agreement: the AI's best artwork among the colours' K cards = the colours' best
          let bi = gtop[0].index;
          for (const c of gtop) if (se[c.index] > se[bi]) bi = c.index;
          if (groups[bi] === gtop[0].group) return { forced: true, top: gtop.slice(0, 12), images: bottoms.size };
        }
        const s = new Float32Array(sg.length).fill(-Infinity);
        for (const c of gtop) s[c.index] = f.alpha * se[c.index] + (1 - f.alpha) * sg[c.index];
        return { forced: false, top: topFromScores(s, ids, groups, 12, excl), images: bottoms.size };
      };
      const a = run(null);
      const b = run(exclude);
      if (!a.forced) { f.aiQueries++; f.aiImages += a.images; }
      f.rows[q.kind].push({ id: q.id, group: g, sameNameOthers, qsig, top: a.top, forced: a.forced, loo: b.top, looForced: b.forced, bar });
    }
    if ((qi + 1) % 50 === 0) process.stdout.write(`  ${qi + 1}/${queries.length} photos (${Math.round((Date.now() - t0) / 1000)} s)   \r`);
  }
  console.log(`\nAnalyse terminée en ${Math.round((Date.now() - t0) / 1000)} s\n`);

  const nm = (id) => nameOf.get(id);
  const report = { date: new Date().toISOString().slice(0, 10), seed: SEED, photos: { simulated: queries.filter(q => q.kind === 'sim').length, real: queries.filter(q => q.kind === 'real').length }, configs: [] };
  const all = [...configs.map(c => ({ ...c, kind: 'engine' })), ...fusionCfgs.map(f => ({ ...f, kind: 'fusion' })), ...cascadeCfgs.map(f => ({ ...f, kind: 'cascade' })),
    ...(FRAME ? cascadeCfgs.map(f => ({ ...f, key: `${f.key} +cadre${FRAME.tol}`, kind: 'cascade', frame: true })) : [])];
  for (const c of all) {
    const cal = calibrate(c.rows.sim, c.index, PRUDENT_LIMITS, !!c.frame);
    if (checkCalibration) {
      const slow = calibrateSlow(c.rows.sim, c.index, PRUDENT_LIMITS, !!c.frame);
      if (JSON.stringify(slow?.t) !== JSON.stringify(cal?.t) || JSON.stringify(slow?.m) !== JSON.stringify(cal?.m)) throw new Error(`calibrage rapide ≠ lent pour ${c.key}`);
      console.log(`  calibrage rapide = lent : ${c.key}`);
    }
    const t = cal?.t || null;
    const entry = {
      config: c.key,
      sizeMB: c.kind === 'engine' ? +(c.engine.size / 1e6).toFixed(1) : null,
      msPerCard: c.kind === 'engine' ? +(c.ms / queries.length).toFixed(1) : null,
      thresholds: t ? { abs: t.abs, margin: t.margin } : null,
      // Cascade: share of the photos that needed the AI, model images per such photo
      ...(c.kind === 'cascade' ? { aiShare: +(c.aiQueries / queries.length).toFixed(3), aiImagesPerAIPhoto: c.aiQueries ? +(c.aiImages / c.aiQueries).toFixed(2) : 0 } : {}),
      // « Rapide » mode (≤ 10 % out of catalog, ≤ 2 % wrong), measured on the simulated photos
      thresholdsFast: (() => { const f = calibrate(c.rows.sim, c.index, FAST_LIMITS, !!c.frame); return f ? { abs: f.t.abs, margin: f.t.margin, acceptedRight: f.m.acceptedRight, acceptedWrong: f.m.acceptedWrong, falsePositiveOutOfCatalog: f.m.falsePositiveOutOfCatalog } : null; })(),
      simulated: t ? measure(c.rows.sim, c.index, t, nm, !!c.frame) : { top1: measure(c.rows.sim, c.index, DECISION, nm)?.top1, note: 'aucun réglage ne tient ≤ 1 % hors catalogue et ≤ 0,5 % faux' },
      real: c.rows.real.length && t ? measure(c.rows.real, c.index, t, nm, !!c.frame) : null,
    };
    report.configs.push(entry);
  }
  fs.writeFileSync(path.join(root, 'model', 'eval-compare.json'), JSON.stringify(report, null, 2));

  const head = 'moteur · région                 top-1   top-5   acc. juste  acc. FAUSSE  rejetée  hors cat.  rééditions   ms/carte  taille';
  for (const kind of ['simulated', 'real']) {
    if (kind === 'real' && !report.photos.real) { console.log('\nPhotos RÉELLES : aucune (model/real-photos/<id-carte>/).'); continue; }
    console.log(`\n${kind === 'simulated' ? `Photos SIMULÉES (${report.photos.simulated})` : `Photos RÉELLES (${report.photos.real})`} — seuils calibrés par moteur (≤ 1 % hors catalogue, ≤ 0,5 % faux)`);
    console.log(head);
    for (const e of report.configs) {
      const m = e[kind];
      if (!m) continue;
      console.log(`${e.config.padEnd(30)} ${pct(m.top1)} ${pct(m.top5)}  ${pct(m.acceptedRight)}    ${pct(m.acceptedWrong)}  ${pct(m.rejected)} ${pct(m.falsePositiveOutOfCatalog)}  ${pct(m.reprintConfusion)}  ${e.msPerCard != null ? String(e.msPerCard).padStart(7) : '      —'}  ${e.sizeMB != null ? `${e.sizeMB} Mo` : '—'}`);
    }
  }
  if (VERIFY) {
    const vhead = 'liste courte → vérification       dans la liste  acc. juste  acc. FAUSSE  refusée  rejetée  hors cat.';
    report.verify = [];
    for (const kind of ['simulated', 'real']) {
      const rk = kind === 'simulated' ? 'sim' : 'real';
      if (!report.photos[kind === 'simulated' ? 'simulated' : 'real']) continue;
      console.log(`\nVÉRIFICATION PAR PIXELS — photos ${kind === 'simulated' ? 'SIMULÉES' : 'RÉELLES'}`);
      console.log(vhead);
      for (const c of all) {
        if (c.frame) continue;
        for (const K of VERIFY.Ks) {
          for (const o of VERIFY.opts) {
            const t0 = performance.now();
            const m = verifyMeasure(c.rows[rk], K, o);
            const ms = (performance.now() - t0) / (2 * c.rows[rk].length);
            if (!m) continue;
            const label = `${c.key} K${K} ${o.minScore}/${o.minMargin}`;
            report.verify.push({ kind, config: c.key, K, ...o, msPerPhoto: +ms.toFixed(1), ...m });
            console.log(`${label.padEnd(34)} ${pct(m.inList)}     ${pct(m.acceptedRight)}    ${pct(m.acceptedWrong)}  ${pct(m.refused)} ${pct(m.rejected)} ${pct(m.falsePositiveOutOfCatalog)}  ${ms.toFixed(1)} ms`);
            if (m.wrongs.length) console.log(`    fausses : ${m.wrongs.slice(0, 12).join(', ')}`);
          }
        }
      }
    }
    // The app's decision + the pixel check (veto / rescue), thresholds calibrated as above
    report.combined = [];
    for (const kind of ['simulated', 'real']) {
      const rk = kind === 'simulated' ? 'sim' : 'real';
      if (!c0Rows(all, rk)) continue;
      console.log(`\nDÉCISION DE L'APPLI + VÉRIFICATION — photos ${kind === 'simulated' ? 'SIMULÉES' : 'RÉELLES'} (juste / FAUSSE / hors cat.)`);
      for (const c of all) {
        if (c.frame || c.kind === 'engine') continue;
        const cal = calibrate(c.rows.sim, c.index, PRUDENT_LIMITS);
        if (!cal) continue;
        for (const K of VERIFY.Ks) {
          for (const o of VERIFY.opts) {
            const m = combinedMeasure(c.rows[rk], c.index, cal.t, K, o);
            report.combined.push({ kind, config: c.key, K, ...o, ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { acceptedRight: v.acceptedRight, acceptedWrong: v.acceptedWrong, falsePositiveOutOfCatalog: v.falsePositiveOutOfCatalog }])) });
            const cell = (v) => `${pct(v.acceptedRight)} / ${pct(v.acceptedWrong)} / ${pct(v.falsePositiveOutOfCatalog)}`;
            console.log(`${(`${c.key} K${K} ${o.minScore}/${o.minMargin}`).padEnd(62)} appli ${cell(m.app)} | veto ${cell(m.veto)} | veto+secours ${cell(m['veto+rescue'])} | secours ${cell(m.rescue)}`);
            const w = m['veto+rescue'].wrongs.filter(x => !m.app.wrongs.includes(x));
            if (w.length) console.log(`    fausses ajoutées (veto+secours) : ${w.slice(0, 10).join(', ')}`);
          }
        }
      }
    }
    fs.writeFileSync(path.join(root, 'model', 'eval-compare.json'), JSON.stringify(report, null, 2));
  }
  console.log('\nRapport : model/eval-compare.json');
}

