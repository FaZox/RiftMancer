// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
/* Card recognition: fingerprint = catalog, centred score + margin, reprint groups. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { NO_LFS } from './helpers.mjs';

const { gridFeatures, queryViews } = await import('../src/lib/fingerprint.js');
const { MatchIndex, decodeFeatures, DECISION, DECISION_PRUDENT } = await import('../src/lib/matchIndex.js');

const catalog = JSON.parse(readFileSync(new URL('../public/card-hashes.json', import.meta.url), 'utf8'));
const cards = catalog.cards.map(c => ({ id: c.id, f: decodeFeatures(c.f), artBottom: c.artBottom, artGroup: c.artGroup }));
const index = new MatchIndex(cards);

async function pixels(id) {
  const { data, info } = await sharp(new URL(`../public/cards/${id}.webp`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: data, w: info.width, h: info.height };
}

test('the app fingerprint reproduces the catalog one (scraper, INTER_AREA)', { skip: NO_LFS }, async () => {
  for (const id of ['ogn-001-298', 'ogn-042-298', 'sfd-239-star-221']) {
    const c = catalog.cards.find(x => x.id === id);
    const { rgba, w, h } = await pixels(id);
    const f = gridFeatures(rgba, w, h, c.artBottom, catalog.gridSize);
    const g = decodeFeatures(c.f);
    let maxDiff = 0;
    for (let i = 0; i < f.length; i++) maxDiff = Math.max(maxDiff, Math.abs(f[i] - g[i]));
    assert.ok(maxDiff * 255 <= 1, `${id}: écart ${maxDiff * 255}`);
  }
});

test('unrelated cards score around 0 once centred (not 0.84)', () => {
  const d = index.dim;
  let sum = 0;
  let n = 0;
  for (let a = 0; a < 200; a += 7) for (let b = a + 3; b < 400; b += 11) {
    let dot = 0;
    for (let j = 0; j < d; j++) dot += index.vecs[a * d + j] * index.vecs[b * d + j];
    sum += dot; n++;
  }
  assert.ok(Math.abs(sum / n) < 0.2, `moyenne ${sum / n}`);
});

test('a catalog card is recognised and accepted; absent from the catalog it is rejected', { skip: NO_LFS }, async () => {
  const id = 'ogn-001-298';
  const { rgba, w, h } = await pixels(id);
  const views = queryViews(rgba, w, h, index.bottoms, 16);
  const top = index.rank(views);
  assert.equal(top[0].id, id);
  const d = index.decide(top);
  assert.equal(d.accepted, true);
  assert.equal(d.level, 'sure');
  // Same photo, card removed from the base (new set not in the catalog yet).
  const g = index.group[index.ids.indexOf(id)];
  const loo = index.rank(views, { exclude: (i) => index.group[i] === g });
  // « Prudent » mode refuses it (the default « take the best card » may not).
  assert.equal(index.decide(loo, DECISION_PRUDENT).accepted, false);
});

test('reprints with the same artwork share a group: no coin toss, all sets offered', { skip: NO_LFS }, async () => {
  const group = (id) => cards.find(c => c.id === id)?.artGroup;
  assert.ok(group('rad-r02'), 'rad-r02 groupée');
  assert.equal(group('rad-r02'), group('ven-r02'));
  assert.equal(group('ogn-274-298'), group('unl-t07')); // Sprite
  const { rgba, w, h } = await pixels('ven-r02');
  const d = index.decide(index.rank(queryViews(rgba, w, h, index.bottoms, 16)));
  assert.equal(d.accepted, true); // the reprint does not count as a rival
  assert.ok(d.sameArt.includes('rad-r02') && d.sameArt.includes('ven-r02'));
});

test('rank keeps the best candidates sorted', { skip: NO_LFS }, async () => {
  const { rgba, w, h } = await pixels('ogn-042-298');
  const top = index.rank(queryViews(rgba, w, h, index.bottoms, 16), { k: 10 });
  assert.equal(top.length, 10);
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].score >= top[i].score);
});

test('decision thresholds are the calibrated ones (see model/eval-report.json)', () => {
  assert.ok(DECISION.abs > 0 && DECISION.abs < 1);
  assert.ok(DECISION.margin > 0 && DECISION.sureMargin >= DECISION.margin);
  assert.equal(DECISION, DECISION_PRUDENT, 'prudent is the only mode (lot 1.4)');
});

test('CardMatcher (app path): initialize + identifyPixels', { skip: NO_LFS }, async () => {
  globalThis.__BUILD_TIME__ = 'test';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(catalog), { status: 200 });
  try {
    const { default: CardMatcher } = await import('../src/lib/cardMatcher.js');
    const m = new CardMatcher();
    await m.initialize();
    const { rgba, w, h } = await pixels('rad-r02');
    const r = await m.identifyPixels(rgba, w, h);
    assert.equal(r.accepted, true);
    assert.ok(['rad-r02', 'ven-r02', 'ogn-042-298', 'unl-r02'].includes(r.card.id));
    assert.deepEqual(r.sameArt.map(c => c.id).sort(), ['ogn-042-298', 'rad-r02', 'unl-r02', 'ven-r02']); // unl-r02: manual addition (model/manual-cards/)
    assert.ok(r.similarity > 0.5 && r.similarity <= 1);
    assert.ok(r.top.length >= 5 && r.top[0].card.id === r.card.id);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('learning: a corrected photo becomes an example, the next similar photo is recognised', { skip: NO_LFS }, async () => {
  globalThis.__BUILD_TIME__ = 'test';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(catalog), { status: 200 });
  try {
    const { default: CardMatcher } = await import('../src/lib/cardMatcher.js');
    const m = new CardMatcher();
    await m.initialize();
    // A heavily tinted / washed out photo of a card (sleeve glare, bad light).
    const id = 'ogn-042-298';
    const { rgba, w, h } = await pixels(id);
    const spoil = (seed) => {
      const out = new Uint8ClampedArray(rgba.length);
      for (let i = 0; i < rgba.length; i += 4) {
        const n = ((i * 2654435761 + seed) >>> 0) % 21 - 10;
        out[i] = 0.45 * rgba[i] + 120 + n; out[i + 1] = 0.45 * rgba[i + 1] + 100 + n; out[i + 2] = 0.4 * rgba[i + 2] + 60 + n; out[i + 3] = 255;
      }
      return out;
    };
    const first = await m.identifyPixels(spoil(1), w, h);
    const sample = first.learnSample(id);
    assert.equal(typeof sample, 'string');
    m.setLearned([{ id: 'l1', cardId: id, f: sample }]);
    assert.equal(m.learnedCount, 1);
    const next = await m.identifyPixels(spoil(2), w, h);
    assert.ok([id, 'rad-r02', 'ven-r02'].includes(next.card.id), next.card.id);
    assert.equal(next.accepted, true);
    // Each card once in the suggestions and in the printings
    const ids = next.top.map(t => t.card.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(next.sameArt.map(c => c.id)).size, next.sameArt.length);
    // Guard: a clean photo of this card is not learned as a very different card
    const clean = await m.identifyPixels(rgba, w, h);
    assert.equal(clean.learnSample('ogn-001-298'), null);
    // Forget → back to the catalog only
    m.setLearned([]);
    assert.equal(m.learnedCount, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
