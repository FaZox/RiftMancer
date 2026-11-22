// Cardmarket card pages (src/lib/cardmarket.js, prices.links built by priceBuilder.js
// and electron/prices.cjs) and the promo prices with the catalog's promo printings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import './helpers.mjs'; // build-time globals of the app

const { cardmarketUrl } = await import('../src/lib/cardmarket.js');
const { getPricesState } = await import('../src/lib/prices.js');
const pb = await import('../src/lib/priceBuilder.js');
const { rifthuntCardIndex } = await import('../src/lib/rifthunt.js');
const pc = createRequire(import.meta.url)('../electron/prices.cjs');

const FR = 'https://www.cardmarket.com/fr/Riftbound/Products/Singles';

// Cardmarket's real ids (17/11/2026): Unleashed 6491, Unleashed Promos 6567, Origins 6286, Origins Promos 6322, Radiance 6659
const products = [
  { idProduct: 883998, name: 'Mutated Mouser', idExpansion: 6491, idMetacard: 462202 },
  { idProduct: 885260, name: 'Mutated Mouser', idExpansion: 6567, idMetacard: 462202 },
  { idProduct: 883999, name: 'Arena Kingpin', idExpansion: 6491, idMetacard: 462203 },
  { idProduct: 845712, name: 'Jinx, Loose Cannon', idExpansion: 6286, idMetacard: 453001 },
  { idProduct: 845713, name: "Kai'Sa, Survivor", idExpansion: 6286, idMetacard: 453002 },
  { idProduct: 845714, name: 'B.F. Sword', idExpansion: 6286, idMetacard: 453003 },
  { idProduct: 874129, name: 'Annie, Dark Child', idExpansion: 6322, idMetacard: 453004 },
  { idProduct: 862196, name: 'Jinx, Loose Cannon', idExpansion: 6322, idMetacard: 453001 },
  { idProduct: 917249, name: "K'Sante, Dauntless", idExpansion: 6659, idMetacard: 470001 },
  { idProduct: 917250, name: "K'Sante, Dauntless", idExpansion: 6659, idMetacard: 470001 },
];
const card = (id, name, set, setName, over = {}) => ({ id, name, set, setName, code: `${set}-${id.split('-')[1]}/${id.split('-')[2]}`, ...over });
const catalog = [
  card('unl-036-219', 'Mutated Mouser', 'UNL', 'Unleashed'),
  card('unl-037-219', 'Arena Kingpin', 'UNL', 'Unleashed'),
  card('ogn-251-298', 'Loose Cannon', 'OGN', 'Origins', { type: 'legend', tags: ['Jinx'] }),
  card('ogn-039-298', 'Survivor', 'OGN', 'Origins'),
  card('ogn-100-298', 'B.F. Sword', 'OGN', 'Origins'),
  card('rad-045-167', "K'Sante", 'RAD', 'Radiance'),
  card('rad-045a-167', "K'Sante", 'RAD', 'Radiance'),
  card('opp-036-219', 'Mutated Mouser', 'OPP', 'Riftbound Organized Play Promotional Cards', { variant: 'promo' }),
  card('opp-017-024', 'Dark Child', 'OPP', 'Riftbound Organized Play Promotional Cards', { variant: 'promo' }),
];
// rifthunt: ids for every printing, addresses with Cardmarket's versions (one promo wrongly put in the normal set)
const rh = (riftboundId, name, cardmarketId, url, over = {}) => ({ riftboundId, name, cardmarketId: String(cardmarketId), cardmarketUrl: `https://www.cardmarket.com/en/Riftbound/Products/Singles/${url}`, ...over });
const index = rifthuntCardIndex([
  rh('unl-036-219', 'Mutated Mouser', 883998, 'Unleashed/Mutated-Mouser'),
  rh('opp-036-219', 'Mutated Mouser', 885260, 'Unleashed-Promos/Mutated-Mouser'),
  rh('unl-037-219', 'Arena Kingpin', 883999, 'Unleashed/Arena-Kingpin'),
  rh('ogn-251-298', 'Jinx, Loose Cannon', 845712, 'Origins/Jinx-Loose-Cannon'),
  rh('ogn-039-298', "Kai'Sa, Survivor", 845713, 'Origins/KaiSa-Survivor'),
  rh('ogn-100-298', 'B.F. Sword', 845714, 'Origins/BF-Sword'),
  rh('opp-017-024', 'Annie, Dark Child', 874129, 'Origins/Annie-Dark-Child'),
  rh('pr-251-298', 'Jinx, Loose Cannon', 862196, 'Origins-Promos/Jinx-Loose-Cannon'),
  rh('rad-045-167', "K'Sante, Dauntless", 917250, 'Radiance/KSante-Dauntless-V1-Epic'),
  rh('rad-045a-167', "K'Sante, Dauntless (Alternate Art)", 917249, 'Radiance/KSante-Dauntless-V2-Showcase'),
]);
const guide = { createdAt: '2026-11-22', priceGuides: products.map(p => ({ idProduct: p.idProduct, trend: p.idProduct / 100000, 'trend-foil': null })) };

test('Cardmarket names in addresses: apostrophes and dots dropped, the rest a hyphen', () => {
  assert.equal(pb.cardmarketSlug("Kai'Sa, Survivor"), 'KaiSa-Survivor');
  assert.equal(pb.cardmarketSlug('Jinx, Loose Cannon'), 'Jinx-Loose-Cannon');
  assert.equal(pb.cardmarketSlug('B.F. Sword'), 'BF-Sword');
  assert.equal(pb.cardmarketSlug('Shadow Clone // Tentacle'), 'Shadow-Clone-Tentacle');
  assert.equal(pb.cardmarketSlug('Unleashed'), 'Unleashed');
  assert.equal(pc.cardmarketSlug("Spirit's Refuge"), 'Spirits-Refuge');
});

test('price table links: set name, « -Promos », Cardmarket versions; the same on the PC and the phone', () => {
  const t = pb.buildPriceTable(catalog, { products }, guide, { source: 'rifthunt', ...index }, null);
  assert.deepEqual(t.links['unl-036-219'], ['Unleashed/Mutated-Mouser', 'Unleashed-Promos/Mutated-Mouser']);
  assert.deepEqual(t.links['unl-037-219'], ['Unleashed/Arena-Kingpin', null], 'no promo on Cardmarket');
  assert.deepEqual(t.links['ogn-251-298'], ['Origins/Jinx-Loose-Cannon', 'Origins-Promos/Jinx-Loose-Cannon']);
  assert.equal(t.links['ogn-039-298'][0], 'Origins/KaiSa-Survivor');
  assert.equal(t.links['ogn-100-298'][0], 'Origins/BF-Sword');
  assert.equal(t.links['rad-045-167'][0], 'Radiance/KSante-Dauntless-V1-Epic');
  assert.equal(t.links['rad-045a-167'][0], 'Radiance/KSante-Dauntless-V2-Showcase');
  // the catalog's promo printings: their page among the promos (rifthunt's « Origins/… » corrected)
  assert.deepEqual(t.links['opp-036-219'], ['Unleashed-Promos/Mutated-Mouser', 'Unleashed-Promos/Mutated-Mouser']);
  assert.equal(t.links['opp-017-024'][0], 'Origins-Promos/Annie-Dark-Child');
  // PC: same table
  const mapping = pc.buildMapping(catalog, products, index);
  assert.deepEqual(pc.buildLinks(catalog, mapping, products, index.paths), t.links);
});

test('prices: rifthunt ids (versions in their order), promo printings priced, promo table without them', () => {
  const t = pb.buildPriceTable(catalog, { products }, guide, { source: 'rifthunt', ...index }, null);
  assert.equal(t.cards['rad-045-167'][2], 917250, 'V1, rifthunt id, not the order of the names');
  assert.equal(t.cards['rad-045a-167'][2], 917249);
  assert.equal(t.cards['opp-036-219'][2], 885260, 'the promo printing has the promo price');
  assert.deepEqual(t.promo['unl-036-219'], [8.85, null, 1], 'its promo: 885260 / 100000 €');
  assert.equal(t.promo['opp-036-219'], undefined);
  assert.equal(t.matched, catalog.length);
  // without rifthunt (Riftcodex's names): promo printings are not matched by name
  const byName = pb.buildMapping(catalog, products, { 'unl-036-219': 'Mutated Mouser' });
  assert.equal(byName['opp-036-219'], undefined);
  assert.equal(byName['unl-036-219'], 883998);
});

test('card pages: the user\'s Mutated Mouser, normal and promo, with the filters of Réglages', () => {
  getPricesState().prices = pb.buildPriceTable(catalog, { products }, guide, { source: 'rifthunt', ...index }, null);
  assert.equal(cardmarketUrl(catalog[0]), `${FR}/Unleashed/Mutated-Mouser?sellerCountry=12&language=1,2&minCondition=4`);
  assert.equal(cardmarketUrl(catalog[0], { promo: true }), `${FR}/Unleashed-Promos/Mutated-Mouser?sellerCountry=12&language=1,2`);
  assert.equal(cardmarketUrl(catalog[7]), `${FR}/Unleashed-Promos/Mutated-Mouser?sellerCountry=12&language=1,2`, 'promo printing');
  // no price table: from the set and the English name
  getPricesState().prices = null;
  assert.equal(cardmarketUrl({ id: 'x', name: 'Jinx - Loose Cannon', nameEn: 'Jinx - Loose Cannon', setName: 'Origins' }), `${FR}/Origins/Jinx-Loose-Cannon?sellerCountry=12&language=1,2&minCondition=4`);
  assert.equal(cardmarketUrl({ id: 'x', name: 'Mutated Mouser', setName: 'Unleashed' }, { promo: true }), `${FR}/Unleashed-Promos/Mutated-Mouser?sellerCountry=12&language=1,2`);
});

test('several products of one name with no rifthunt address: « -V<n>-<Rarity> » in Cardmarket\'s order; Top 8 / Champion promos', () => {
  // Radiance 6659, Radiance Promos 6921 (17/11/2026): the user's Akali, Brash promo is « Radiance-Promos/Akali-Brash-V2-Rare »
  const prods = [
    { idProduct: 917220, name: 'Akali, Brash', idExpansion: 6659, idMetacard: 471432 },
    { idProduct: 917410, name: 'Akali, Brash', idExpansion: 6659, idMetacard: 471432 },
    { idProduct: 917404, name: 'Akali, Brash', idExpansion: 6921, idMetacard: 471432 },
    { idProduct: 917405, name: 'Akali, Brash', idExpansion: 6921, idMetacard: 471432 },
    { idProduct: 917300, name: 'Lulu, Whimsical', idExpansion: 6659, idMetacard: 471500 },
    { idProduct: 917301, name: 'Lulu, Whimsical', idExpansion: 6659, idMetacard: 471500 },
  ];
  const oracle = '5a45c9790d094c45';
  const cat = [
    card('rad-015-167', 'Akali', 'RAD', 'Radiance', { rarity: 'rare', variant: 'base', oracle }),
    card('rad-sp2-005', 'Akali', 'RAD', 'Radiance', { rarity: 'showcase', variant: 'showcase', oracle }),
    card('rad-110-167', 'Lulu', 'RAD', 'Radiance', { rarity: 'epic', variant: 'base' }),
    card('rad-110a-167', 'Lulu', 'RAD', 'Radiance', { rarity: 'epic', variant: 'alternate' }),
    card('opp-015-167-champion', 'Akali', 'OPP', 'Riftbound Organized Play Promotional Cards', { variant: 'promo', printLabel: 'Champion', oracle }),
    card('opp-015-167-top-8', 'Akali', 'OPP', 'Riftbound Organized Play Promotional Cards', { variant: 'promo', printLabel: 'Top 8', oracle }),
  ];
  const idx = rifthuntCardIndex([
    rh('rad-015-167', 'Akali, Brash', 917220, 'Radiance/Akali-Brash-V1-Rare'),
    rh('rad-sp2-005', 'Akali, Brash (K/DA Special Art Card)', 917410, 'Radiance/Akali-Brash'),
    rh('rad-110-167', 'Lulu, Whimsical', 917300, ''), rh('rad-110a-167', 'Lulu, Whimsical (Alternate Art)', 917301, ''),
  ]);
  const t = pb.buildPriceTable(cat, { products: prods }, { priceGuides: prods.map(p => ({ idProduct: p.idProduct, trend: 1 })) }, { source: 'rifthunt', ...idx }, null);
  // rifthunt does not link the promo printings: Top 8 first, then Champion (Cardmarket's order of addition)
  assert.equal(t.cards['opp-015-167-top-8'][2], 917404);
  assert.equal(t.cards['opp-015-167-champion'][2], 917405);
  assert.deepEqual(t.links['opp-015-167-champion'], ['Radiance-Promos/Akali-Brash-V2-Rare', 'Radiance-Promos/Akali-Brash-V2-Rare']);
  assert.equal(t.links['opp-015-167-top-8'][0], 'Radiance-Promos/Akali-Brash-V1-Rare');
  // the normal card: rifthunt's address; its promo button: the Champion one
  assert.deepEqual(t.links['rad-015-167'], ['Radiance/Akali-Brash-V1-Rare', 'Radiance-Promos/Akali-Brash-V2-Rare']);
  // no address at all: versions numbered in Cardmarket's order, with the rarity of the printing
  assert.equal(t.links['rad-110-167'][0], 'Radiance/Lulu-Whimsical-V1-Epic');
  assert.equal(t.links['rad-110a-167'][0], 'Radiance/Lulu-Whimsical-V2-Showcase');
  const m = pc.buildMapping(cat, prods, idx);
  assert.deepEqual(pc.buildLinks(cat, m, prods, idx.paths), t.links, 'same on the PC');
  getPricesState().prices = t;
  assert.equal(cardmarketUrl(cat[4]), `${FR}/Radiance-Promos/Akali-Brash-V2-Rare?sellerCountry=12&language=1,2`);
});
