// Lot 4.2: « Rechercher de nouvelles cartes » — simulated gallery, parity, reprint groups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const G = await import('../src/lib/galleryCards.js');
const { checkParity, paritySample, PARITY } = await import('../src/lib/cardPipeline.js');
const { computeGroups, groupPatches } = await import('../src/lib/artGroups.js');
const { encodeFeatures } = await import('../src/lib/matchIndex.js');
const { encodeEmbedding } = await import('../src/lib/engines/index.js');

/** A gallery card shaped like Riot's (__NEXT_DATA__ … cards.items). */
const rawCard = (id, name, { set = 'VEN', setName = 'Vendetta', type = 'unit', text = '<p>Text</p>', full = null, energy = 3 } = {}) => ({
  id, name, collectorNumber: Number(id.split('-')[1]) || 1, publicCode: `${id.split('-')[0].toUpperCase()}-${id.split('-')[1]}/166`,
  set: { label: 'Card Set', value: { id: set, label: setName } },
  cardType: { label: 'Card Type', type: [{ id: type, label: type }], ...(full ? { superType: [{ id: 'champion' }] } : {}) },
  rarity: { value: { id: 'common', label: 'Common' } },
  domain: { values: [{ id: 'fury', label: 'Fury' }] },
  cardImage: { url: `https://cmsassets.rgpub.io/sanity/images/x/${id}.png`, accessibilityText: `Riftbound ${type}: ${full || name}. Some text.` },
  orientation: type === 'battlefield' ? 'landscape' : 'portrait',
  illustrator: { values: [{ label: 'Artist' }] },
  tags: { tags: ['Noxus'] },
  energy: { value: { id: energy } }, might: { value: { id: 2 } },
  text: { richText: { body: text } },
});
const page = (items) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { page: { blades: [{}, {}, { cards: { items } }] } } } })}</script></html>`;

const known = [rawCard('ven-001-166', 'Old One'), rawCard('ven-002-166', 'Old Two'), rawCard('ven-003-166', 'Riven', { full: 'Riven, Broken Blade' }),
  rawCard('ven-004-166', 'Four'), rawCard('ven-005-166', 'Five'), rawCard('ven-006-166', 'Six')];
const catalog = known.map(r => ({ ...G.normalizeGalleryCard(r).card, f: 'AAAA', e: 'BBBB' }));
delete catalog[2].nameEn; // the shipped catalog lacks the champion's full name
catalog.push({ id: 'ven-r01', name: 'Manual', code: 'VEN-099/166', manual: true, f: 'x' });

test('simulated gallery: 3 new cards, 1 changed, full name filled, manual card made official', () => {
  const items = [...known, rawCard('ven-010-166', 'New A'), rawCard('ven-011-166', 'Arena', { type: 'battlefield' }), rawCard('ven-099-166', 'Made Official')];
  items[1] = rawCard('ven-002-166', 'Old Two', { text: '<p>Errata</p>', energy: 4 });
  const ch = G.galleryChanges(G.extractGalleryCards(page(items)), catalog);
  assert.deepEqual(ch.added.map(a => a.card.id), ['ven-010-166', 'ven-011-166', 'ven-099-166']);
  assert.equal(ch.added[1].card.artBottom, 0.95, 'battlefield: full-art crop');
  assert.equal(ch.added[0].imageUrl, 'https://cmsassets.rgpub.io/sanity/images/x/ven-010-166.png');
  assert.deepEqual(ch.changed.map(c => [c.card.id, c.fields]), [['ven-002-166', ['energy', 'text']], ['ven-003-166', ['nameEn']]]);
  assert.equal(ch.changed[1].card.nameEn, 'Riven, Broken Blade');
  assert.deepEqual(ch.manualOfficial, ['ven-r01'], 'printed code now official');
  assert.equal(G.galleryText(ch), '3 nouvelles cartes (Vendetta), 2 cartes modifiées.');
  assert.equal(G.galleryText({ added: [], changed: [] }), 'Aucune nouvelle carte : le catalogue est à jour.');
});

test('full English name only when it starts with the card name and a comma', () => {
  assert.equal(G.normalizeGalleryCard(rawCard('sfd-161-221', 'B.F. Sword')).card.nameEn, undefined);
  assert.equal(G.normalizeGalleryCard(rawCard('rad-043-167', 'Riven', { full: 'Riven, Broken Blade' })).card.nameEn, 'Riven, Broken Blade');
  assert.equal(G.normalizeGalleryCard({ id: '../x', name: 'x' }), null, 'unsafe id refused');
});

test('unexpected structure or a gallery half empty: an error, nothing to install', () => {
  assert.throws(() => G.extractGalleryCards('<html>no data</html>'), /n’a pas pu être lue/);
  assert.throws(() => G.extractGalleryCards(page([{ id: 'a' }])), /n’a pas pu être lue/);
  assert.throws(() => G.galleryChanges(G.extractGalleryCards(page(known)).slice(0, 2), catalog), /n’a pas pu être lue/, 'only 2 of the 6 cards: a reading problem');
});

test('parity: identical features pass; one card off fails, nothing would be installed', async () => {
  const f = encodeFeatures(Float32Array.from({ length: 768 }, (_, i) => (i % 255) / 255));
  const e = encodeEmbedding(Float32Array.from({ length: 384 }, (_, i) => Math.sin(i)));
  const cards = Array.from({ length: 80 }, (_, i) => ({ id: `c-${i}`, f, e, artBottom: 0.55 }));
  const sample = paritySample(cards);
  assert.equal(sample.length, PARITY.samples);
  let r = await checkParity(sample, async () => ({ f, e }));
  assert.equal(r.ok, true);
  assert.equal(r.worstByte, 0);
  const off = encodeFeatures(Float32Array.from({ length: 768 }, (_, i) => ((i % 255) + (i === 5 ? 9 : 0)) / 255));
  r = await checkParity(sample, async (c) => ({ f: c.id === sample[3].id ? off : f, e }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.failures, [sample[3].id]);
  r = await checkParity(sample, async () => ({ f, e: encodeEmbedding(Float32Array.from({ length: 384 }, (_, i) => Math.cos(i))) }));
  assert.equal(r.ok, false, 'AI signatures that differ fail too');
});

test('reprint groups: same picture grouped, other pictures alone; patches for what changes', () => {
  const v = (seed) => Float32Array.from({ length: 48 }, (_, i) => Math.abs(Math.sin(seed * 31 + i * 7.3)));
  const cards = [{ id: 'a-1', name: 'X' }, { id: 'b-1', name: 'Y' }, { id: 'c-1', name: 'Z', artGroup: 'c-1' }, { id: 'a-2', name: 'X' }];
  const common = [v(1), v(2), v(3), v(1)];
  const g = computeGroups(cards, common);
  assert.deepEqual([...g], [['a-1', 'a-1'], ['a-2', 'a-1']]);
  assert.deepEqual(groupPatches(cards, g), [{ id: 'a-1', artGroup: 'a-1' }, { id: 'c-1', artGroup: null }, { id: 'a-2', artGroup: 'a-1' }]);
});
