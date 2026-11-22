/**
 * Bench of the printing pick (REPRODUIRE-SCANNER-OPENRIFT.md, phase C):
 * for every artwork printed several times in the catalog (runes of each set,
 * « ★ » legends, reprinted tokens…), photos of each printing — simulated from
 * its picture, and real ones — are given to src/lib/printingPick.js with all the
 * printings of the artwork. Counted: right, WRONG, left to the user.
 *
 *   node scripts/eval-printings.mjs [--aug 4] [--seed 7] [--real <dir>]
 *
 * --real <dir>: straightened photos (npm run photos:prepare), <dir>/<card id>/*.png
 * The rule of the phase: 0 wrong printing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { mulberry32, simulatePhoto, realPhoto } from './lib/simulate.mjs';
import { printingSignature, registeredPrintingSignature, resolvePrinting, printingIdentity, unanimousPick, pickByCodeSearch } from '../src/lib/printingPick.js';
import { alignedSignature, alignedScore } from '../src/lib/alignedVerify.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : def);
const AUG = Number(arg('aug', 4));
const SEED = Number(arg('seed', 7));
const REAL = arg('real', null);
// --plain: OpenRift's fixed bands (no search around their place)
const PLAIN = process.argv.includes('--plain');
const PAD = Number(arg('pad', 0.04));
// --simple: each printing's code strip searched on its own, best score with a lead (pickByCodeSearch)
const SIMPLE = process.argv.includes('--simple');
// --native: real photos at the straightened crop's own resolution (not reduced to 480 × 670), card proportions
const NATIVE = process.argv.includes('--native');
async function nativePhoto(file) {
  const m = await sharp(file).rotate().metadata();
  const w = m.width;
  const h = Math.round((w * 1039) / 744);
  const { data, info } = await sharp(file).rotate().resize(w, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: data, w: info.width, h: info.height };
}

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public', 'card-hashes.json'), 'utf8'));
const byId = new Map(catalog.cards.map(c => [c.id, c]));
const groups = new Map();
for (const c of catalog.cards) if (c.artGroup) (groups.get(c.artGroup) || groups.set(c.artGroup, []).get(c.artGroup)).push(c.id);
const multi = [...groups.values()].filter(v => v.length > 1);
const groupOf = new Map(multi.flatMap(v => v.map(id => [id, v])));
console.log(`${multi.length} illustrations imprimées plusieurs fois (${multi.reduce((n, v) => n + v.length, 0)} cartes)`);

async function pixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: data, w: info.width, h: info.height };
}
const refs = new Map();
const align = new Map();
for (const id of groupOf.keys()) {
  const p = await pixels(path.join(root, 'public', 'cards', `${id}.webp`));
  refs.set(id, printingSignature(p.rgba, p.w, p.h, byId.get(id).type));
  align.set(id, alignedSignature(p.rgba, p.w, p.h));
}
const identityOf = (id) => printingIdentity(byId.get(id));

/** The photo turned 180° when that matches the artwork better (the app knows the orientation from the match). */
function upright(img, members) {
  const s0 = alignedSignature(img.rgba, img.w, img.h, 0);
  const s2 = alignedSignature(img.rgba, img.w, img.h, 2);
  const ref = align.get(members[0]);
  if (!(alignedScore(s2, ref) > alignedScore(s0, ref))) return img;
  const out = new Uint8Array(img.rgba.length);
  for (let i = 0; i < img.rgba.length; i += 4) out.set(img.rgba.subarray(i, i + 4), img.rgba.length - 4 - i);
  return { rgba: out, w: img.w, h: img.h };
}

function judge(img, id) {
  const members = groupOf.get(id);
  const up = upright(img, members);
  if (SIMPLE) {
    const sigs = new Map(members.map(m => [m, refs.get(m)]));
    const t0 = performance.now();
    const r = pickByCodeSearch(up.rgba, up.w, up.h, sigs, identityOf, { minScore: -2, minLead: -2, pad: { x: PAD, y: PAD } });
    const ms = performance.now() - t0;
    if (!r) return { outcome: 'none', ms };
    return { outcome: identityOf(r.key).code === identityOf(id).code ? 'right' : 'wrong', via: 'code', got: r.key, margin: r.lead, score: r.score, ms };
  }
  const q = PLAIN ? printingSignature(up.rgba, up.w, up.h, byId.get(id).type) : registeredPrintingSignature(up.rgba, up.w, up.h, byId.get(id).type, refs.get(members[0]), { x: PAD, y: PAD });
  if (!q) return { outcome: 'none' };
  const sigs = new Map(members.map(m => [m, refs.get(m)]));
  const t0 = performance.now();
  const r = resolvePrinting(q, sigs, identityOf);
  const ms = performance.now() - t0;
  if (!r || !unanimousPick(r, identityOf)) return { outcome: 'asked', ms };
  return { outcome: r.key === id ? 'right' : 'wrong', via: r.via, got: r.key, margin: r.margin, ms };
}

function tally(name, rows) {
  const n = rows.length;
  if (!n) return;
  const c = (o) => rows.filter(r => r.outcome === o).length;
  const p = (x) => `${(100 * x / n).toFixed(1)} %`;
  const via = {};
  for (const r of rows) if (r.via) via[r.via] = (via[r.via] || 0) + 1;
  const ms = rows.reduce((s, r) => s + (r.ms || 0), 0) / n;
  console.log(`\n${name} (${n}) : juste ${p(c('right'))} · FAUSSE ${p(c('wrong'))} · laissée au choix ${p(c('asked') + c('none'))} · par ${JSON.stringify(via)} · ${ms.toFixed(1)} ms`);
  const wrongs = rows.filter(r => r.outcome === 'wrong');
  if (wrongs.length) console.log(`  fausses : ${wrongs.slice(0, 20).map(r => `${r.id}→${r.got} (${r.via}, ${r.margin.toFixed(2)})`).join(', ')}`);
  // per kind of group
  const kinds = {};
  for (const r of rows) { const k = r.kind; (kinds[k] ||= []).push(r); }
  for (const [k, list] of Object.entries(kinds)) {
    const m = list.length;
    const q = (o) => list.filter(r => r.outcome === o).length;
    console.log(`  ${k.padEnd(10)} ${String(m).padStart(4)} : juste ${q('right')} · fausse ${q('wrong')} · au choix ${q('asked') + q('none')}`);
  }
}
/** --simple: right / wrong for several (score, lead) thresholds. */
function sweep(rows, label = 'SIMULÉES') {
  console.log(`\nPhotos ${label} (${rows.length}) — recherche de la bande du code, seuils score / avance :`);
  for (const minScore of [0.5, 0.6, 0.7]) {
    for (const minLead of [0.03, 0.05, 0.08, 0.12, 0.16]) {
      let right = 0; let wrong = 0;
      const ws = [];
      for (const r of rows) {
        if (r.outcome === 'none' || r.score < minScore || !(r.margin >= minLead)) continue;
        if (r.outcome === 'right') right++; else { wrong++; ws.push(`${r.id}→${r.got}`); }
      }
      console.log(`  ${minScore} / ${minLead} : juste ${(100 * right / rows.length).toFixed(1)} % · FAUSSE ${(100 * wrong / rows.length).toFixed(1)} %${ws.length ? ` (${ws.slice(0, 6).join(', ')})` : ''}`);
    }
  }
}
const kindOf = (id) => { const c = byId.get(id); return c.type === 'rune' ? 'runes' : /star/.test(id) || groupOf.get(id).some(x => /star/.test(x)) ? '★' : 'autres'; };

const rnd = mulberry32(SEED);
const sim = [];
for (let k = 0; k < AUG; k++) {
  for (const id of groupOf.keys()) {
    const img = await simulatePhoto(path.join(root, 'public', 'cards', `${id}.webp`), rnd);
    sim.push({ id, kind: kindOf(id), ...judge(img, id) });
  }
}
if (SIMPLE) sweep(sim); else tally('Photos SIMULÉES', sim);

if (REAL) {
  const real = [];
  for (const dir of fs.readdirSync(REAL)) {
    const id = dir.toLowerCase();
    if (!groupOf.has(id)) { console.log(`  (réelle ignorée : ${dir}, pas de réédition)`); continue; }
    for (const f of fs.readdirSync(path.join(REAL, dir))) {
      if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
      const img = NATIVE ? await nativePhoto(path.join(REAL, dir, f)) : await realPhoto(path.join(REAL, dir, f));
      real.push({ id, kind: kindOf(id), file: f, ...judge(img, id) });
    }
  }
  if (SIMPLE) sweep(real, 'RÉELLES'); else tally('Photos RÉELLES', real);
  for (const r of real) console.log(`  ${r.id} ${r.file} → ${r.outcome}${r.got ? ` ${r.got} (${r.via}, ${r.margin.toFixed(2)})` : ''}`);
}
