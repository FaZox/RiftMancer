/* rifthunt first (src/lib/rifthunt.js): cards, banned cards, Cardmarket links; the former sources as fallback. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  catalogId, parseRifthuntCards, normalizeRifthuntCard, rifthuntChanges, cardSourceChanges,
  rifthuntCardIndex, rifthuntBanRules, RIFTHUNT_CARDS_URL, RIFTHUNT_BAN_URLS, printingIds, rifthuntImage,
} from '../src/lib/rifthunt.js';
import { buildBanList, diffBans } from '../src/lib/banUpdate.js';
import { buildMapping } from '../src/lib/priceBuilder.js';
import { PageReadError } from '../src/lib/banUpdate.js';

const RIOT = 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/abc-744x1039.png?accountingTag=RB';
const printing = (over = {}) => ({
  riftboundId: 'ogn-066-298', name: 'Ahri, Alluring', num: 66, energy: 5, might: 4, type: 'Unit', supertype: 'Champion',
  rarity: 'Rare', domains: ['Calm'], rich: '<p>When I hold, you score 1 point.</p>', set: 'OGN', setName: 'Origins',
  tags: ['Ahri', 'Ionia'], artist: 'League Splash Team', imgUrl: RIOT, orientation: 'portrait', cardmarketId: '847186', ...over,
});
const file = (cards) => JSON.stringify({ fetched: '2026-11-19', source: 'riotgames.com', cards });
const filler = Array.from({ length: 120 }, (_, i) => printing({ riftboundId: `ogs-${String(i + 1).padStart(3, '0')}-024`, name: `Filler ${i}`, set: 'OGS', setName: 'Proving Grounds', num: i + 1 }));

test('a rifthunt printing in the catalog shape: names, code, lower-case values, Riot picture only', () => {
  const { card, imageUrl } = normalizeRifthuntCard(printing());
  assert.deepEqual(card, {
    nameEn: 'Ahri - Alluring', id: 'ogn-066-298', name: 'Ahri', number: 66, code: 'OGN-066/298', set: 'OGN', setName: 'Origins',
    domain: 'calm', domains: ['calm'], rarity: 'rare', type: 'unit', superTypes: ['champion'], energy: 5, might: 4,
    tags: ['Ahri', 'Ionia'], illustrator: 'League Splash Team', text: '<p>When I hold, you score 1 point.</p>', orientation: 'portrait', artBottom: 0.55,
    variant: 'base',
  });
  assert.equal(imageUrl, RIOT);
  // a Legend is named by its title in the catalog; signatures: « * » → « -star »; runes: upper-case letters in the code
  assert.equal(normalizeRifthuntCard(printing({ riftboundId: 'ogn-251-298', name: 'Jinx, Loose Cannon', type: 'Legend' })).card.name, 'Loose Cannon');
  assert.equal(catalogId('ogn-303*-298'), 'ogn-303-star-298');
  assert.equal(normalizeRifthuntCard(printing({ riftboundId: 'ogn-303*-298' })).card.code, 'OGN-303*/298');
  assert.equal(normalizeRifthuntCard(printing({ riftboundId: 'rad-r01a' })).card.code, 'RAD-R01a');
  assert.equal(normalizeRifthuntCard(printing({ name: 'Ahri, Alluring (Alternate Art)' })).card.nameEn, 'Ahri - Alluring');
  // promo sets: « promo » printings with their label; a picture elsewhere than Riot's: rifthunt's image server
  const promo = normalizeRifthuntCard(printing({ riftboundId: 'opp-255-298', set: 'OPP', name: 'Ahri, Nine-Tailed Fox (Metal)', oracle_id: 'aa32d7c5-0ac7-472e-80f2-468449e4aaef', imgUrl: 'https://tcgplayer-cdn.tcgplayer.com/x.jpg', imgHash: '2576381820df' }), 'opp-255-298-metal');
  assert.deepEqual([promo.card.id, promo.card.variant, promo.card.printLabel, promo.card.oracle, promo.card.name], ['opp-255-298-metal', 'promo', 'Metal', 'aa32d7c50ac7472e', 'Ahri']);
  assert.equal(promo.imageUrl, 'https://images.rifthunt.com/cards/large/front/opp/255/ahri-nine-tailed-fox-metal.webp?v=2576381820df');
  assert.equal(normalizeRifthuntCard(printing({ name: 'Ahri, Alluring (Signature)', variant: 'signature' })).card.printLabel, undefined, 'the kind says it already');
  assert.equal(rifthuntImage(printing({ riftboundId: 'ogn-303*-298', set: 'OGN', name: 'Ahri, Nine-Tailed Fox (Signature)', imgHash: 'abc123' })), 'https://images.rifthunt.com/cards/large/front/ogn/303s/ahri-nine-tailed-fox-signature.webp?v=abc123');
  assert.equal(normalizeRifthuntCard(printing({ imgUrl: 'https://tcgplayer-cdn.tcgplayer.com/x.jpg' })).imageUrl, null, 'no picture hash: no address');
});

test('printings sharing a riftboundId get their own id (« -metal », « -champion », « -top-8 »)', () => {
  const list = [
    printing({ riftboundId: 'opp-255-298', name: 'Ahri, Nine-Tailed Fox' }),
    printing({ riftboundId: 'opp-255-298', name: 'Ahri, Nine-Tailed Fox (Metal)' }),
    printing({ riftboundId: 'opp-038-167', name: 'Ahri, Confident (Champion)' }),
    printing({ riftboundId: 'opp-038-167', name: 'Ahri, Confident (Top 8)' }),
    printing({ riftboundId: 'pr-066-298', name: 'Ahri, Alluring (Launch Exclusive)' }),
  ];
  assert.deepEqual([...printingIds(list).values()], ['opp-255-298', 'opp-255-298-metal', 'opp-038-167-champion', 'opp-038-167-top-8', 'pr-066-298']);
  const index = rifthuntCardIndex([list[0], { ...list[1], cardmarketId: '999' }]);
  assert.deepEqual(index.cardmarket, { 'opp-255-298': 847186, 'opp-255-298-metal': 999 });
});

test('rifthunt against the catalog: links of the prints written apart, new printings with rifthunt pictures', () => {
  const catalog = [{ id: 'ogn-066-298', name: 'Ahri', number: 66, code: 'OGN-066/298', set: 'OGN', setName: 'Origins', domains: ['calm'], rarity: 'rare', type: 'unit', superTypes: ['champion'], energy: 5, might: 4, tags: ['Ahri', 'Ionia'], illustrator: 'League Splash Team', text: '<p>When I hold, you score 1 point.</p>', orientation: 'portrait', nameEn: 'Ahri - Alluring' }, ...filler.map(p => normalizeRifthuntCard(p).card)];
  const oracle = 'aa32d7c5-0ac7-472e-80f2-468449e4aaef';
  const ch = rifthuntChanges([printing({ oracle_id: oracle }), printing({ riftboundId: 'pr-066-298', set: 'PR', setName: 'Riftbound Promotional Cards', name: 'Ahri, Alluring (Launch Exclusive)', oracle_id: oracle, imgUrl: null, imgHash: 'ff00ff' }), ...filler], catalog);
  assert.deepEqual(ch.changed, [], 'the link is not a change');
  assert.deepEqual(ch.links.find(l => l.id === 'ogn-066-298'), { id: 'ogn-066-298', oracle: 'aa32d7c50ac7472e', variant: 'base' });
  assert.deepEqual(ch.added.map(a => [a.card.id, a.card.variant, a.card.printLabel, a.card.oracle]), [['pr-066-298', 'promo', 'Launch Exclusive', 'aa32d7c50ac7472e']]);
  assert.match(ch.added[0].imageUrl, /^https:\/\/images\.rifthunt\.com\/cards\/large\/front\/pr\/066\//);
});

test('rifthunt against the catalog: a missing field is no change, new cards need a picture, manual cards stay', () => {
  const catalog = [
    { id: 'ogn-066-298', name: 'Ahri', number: 66, code: 'OGN-066/298', set: 'OGN', setName: 'Origins', domains: ['calm'], rarity: 'rare', type: 'unit', superTypes: ['champion'], energy: 5, might: 4, tags: ['Ionia', 'Ahri'], illustrator: 'League Splash Team', text: '<p>When I hold, you score 1 point.</p>', orientation: 'portrait', nameEn: 'Ahri - Alluring' },
    { id: 'unl-r01', name: 'Fury Rune', code: 'UNL-R01', set: 'UNL', manual: true },
    ...filler.map(p => normalizeRifthuntCard(p).card),
  ];
  const printings = [
    printing({ might: null, tags: ['Ahri', 'Ionia'] }), // tags in another order, might unknown: no change
    printing({ riftboundId: 'unl-r01', name: 'Fury Rune', set: 'UNL', setName: 'Unleashed', imgUrl: 'https://rifthunt.com/img/cards/unl-r01.png' }), // no picture hash
    printing({ riftboundId: 'ven-001-166', name: 'New Card', set: 'VEN', setName: 'Vendetta', num: 1 }),
    printing({ riftboundId: 'ven-002-166', name: 'No Picture', set: 'VEN', setName: 'Vendetta', num: 2, imgUrl: null }),
    ...filler,
  ];
  const ch = rifthuntChanges(printings, catalog);
  assert.deepEqual(ch.added.map(a => a.card.id), ['ven-001-166']);
  assert.deepEqual(ch.changed, []);
  assert.deepEqual(ch.manualOfficial, [], 'the manual rune is not removed: no picture to replace it');
  // a real change is reported
  const ch2 = rifthuntChanges([printing({ rarity: 'Epic' }), ...filler], catalog);
  assert.deepEqual(ch2.changed.map(c => c.fields), [['rarity']]);
  // the text decides the source: JSON → rifthunt, HTML → Riot's gallery
  assert.equal(cardSourceChanges(file(printings), catalog).source, 'rifthunt');
  assert.throws(() => cardSourceChanges('{"cards": []}', catalog), PageReadError);
  assert.throws(() => parseRifthuntCards('<html>'), PageReadError);
});

test('Cardmarket links: rifthunt ids first, by name for the rest (and all by name without rifthunt)', () => {
  const index = rifthuntCardIndex([printing(), printing({ riftboundId: 'ogn-303*-298', name: 'Ahri, Nine-Tailed Fox (Signature)', cardmarketId: '900' })]);
  assert.deepEqual(index.cardmarket, { 'ogn-066-298': 847186, 'ogn-303-star-298': 900 });
  assert.equal(index.names['ogn-303-star-298'], 'Ahri, Nine-Tailed Fox (Signature)');
  const cards = [
    { id: 'ogn-066-298', name: 'Ahri', set: 'OGN', code: 'OGN-066/298' },
    { id: 'ogn-001-298', name: 'Blazing Scorcher', set: 'OGN', code: 'OGN-001/298' },
  ];
  const products = [
    { idProduct: 847186, idExpansion: 6286, name: 'Ahri, Alluring' },
    { idProduct: 845712, idExpansion: 6286, name: 'Blazing Scorcher' },
  ];
  assert.deepEqual(buildMapping(cards, products, index), { 'ogn-066-298': 847186, 'ogn-001-298': 845712 });
  // former form (Riftcodex's names alone) still accepted
  assert.deepEqual(buildMapping(cards, products, { 'ogn-066-298': 'Ahri, Alluring' }), { 'ogn-066-298': 847186, 'ogn-001-298': 845712 });
});

const search = (cards) => JSON.stringify({ object: 'list', total_cards: cards.length, has_more: false, data: cards });
const banned = (name, type, standard, twoVtwo = standard) => ({
  name, type,
  legalities: { standard: standard ? { status: standard.status || 'banned', banned_from: standard.from ?? null } : { status: 'legal', banned_from: null }, '2v2': { status: twoVtwo?.status || 'banned', banned_from: twoVtwo?.from ?? null } },
});

test('banned cards from rifthunt: each with its date, the announced ones, « The » ignored, no card = empty list', () => {
  const texts = {
    standard: search([banned('Called Shot', 'Spell', { from: '2026-03-31' }), banned('The Dreaming Tree', 'Battlefield', { from: '2026-03-31' })]),
    '2v2': search([banned('Called Shot', 'Spell', { from: '2026-03-31' }), banned('Master Yi, Wuju Bladesman', 'Legend', null, { status: 'banned', from: null })]),
    upcoming: '{"object":"error"}', // rifthunt's 404 when nothing is announced
  };
  const rules = rifthuntBanRules(texts);
  assert.equal(rules.updatedAt, '2026-03-31');
  assert.deepEqual(rules.formats.standard.battlefields, [{ name: 'The Dreaming Tree', since: '2026-03-31' }]);
  assert.deepEqual(rules.formats['2v2'].legends, [{ name: 'Master Yi, Wuju Bladesman' }]);
  assert.match(rules.source.label, /rifthunt/);
  const current = { formats: { standard: { label: 'Standard', banned: [{ name: 'Called Shot', since: '2026-03-31' }, { name: 'Dreaming Tree', battlefield: true, since: '2026-03-31' }] } } };
  const built = buildBanList(current, rules, null, [{ id: 'ogn-x', name: 'Wuju Bladesman', nameEn: 'Master Yi - Wuju Bladesman', type: 'legend' }]);
  assert.deepEqual(diffBans(current, built.list).formats.standard, { added: [], removed: [] }, '« Dreaming Tree » is « The Dreaming Tree »');
  assert.deepEqual(built.list.formats['2v2'].banned.map(e => [e.name, e.since]), [['Master Yi, Wuju Bladesman', '2026-03-31'], ['Called Shot', '2026-03-31'], ['The Dreaming Tree', '2026-03-31']], 'banned in Standard: in 2v2 too');
  // an announced ban counts from its date
  const up = rifthuntBanRules({ ...texts, upcoming: search([banned('Riven, Broken Blade', 'Unit', { status: 'legal', from: '2999-01-01' }, { status: 'legal', from: '2999-01-01' })]) });
  assert.deepEqual(up.formats.standard.cards.at(-1), { name: 'Riven, Broken Blade', since: '2999-01-01' });
  assert.throws(() => rifthuntBanRules({ standard: '<html>', '2v2': '{}', upcoming: '{}' }), PageReadError);
});

test('rifthunt addresses are allowed (and only those); the app tries rifthunt before Riot', async () => {
  const { allowed } = await import('../electron/contentFetch.cjs');
  assert.ok(allowed(RIFTHUNT_CARDS_URL));
  for (const url of Object.values(RIFTHUNT_BAN_URLS)) assert.ok(allowed(url), url);
  assert.ok(!allowed('https://api.rifthunt.com/cards/search?q=anything'));
  assert.ok(!allowed('https://api.rifthunt.com/bulk/prices'));
  assert.ok(allowed('https://images.rifthunt.com/cards/large/front/opp/255/ahri-nine-tailed-fox-metal.webp?v=2576381820df'));
  assert.ok(!allowed('https://images.rifthunt.com/cards/large/front/opp/255/../../x.webp?v=1'));
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const cards = read('src/components/settings/CardsUpdate.jsx');
  assert.ok(cards.indexOf('RIFTHUNT_CARDS_URL') < cards.indexOf('api.content.fetch(GALLERY_URL)'), 'cards: rifthunt, then the gallery');
  assert.match(read('src/lib/contentNotices.js'), /weeklyCheck\('cartes', \[RIFTHUNT_CARDS_URL\], \[GALLERY_URL\]\)/);
  assert.match(read('src/components/settings/BanUpdate.jsx'), /let rules = await rifthuntRules\(api\);\n\s+if \(!rules\)/);
});

test('« Impressions et variantes »: the printings of one card, the normal one first', async () => {
  const { printsOf, printKindLabel } = await import('../src/lib/prints.js');
  const cards = [
    { id: 'opp-255-298-metal', set: 'OPP', number: 255, oracle: 'x', variant: 'promo', printLabel: 'Metal' },
    { id: 'ogn-303-star-298', set: 'OGN', number: 303, oracle: 'x', variant: 'signature' },
    { id: 'ogn-255-298', set: 'OGN', number: 255, oracle: 'x', variant: 'base' },
    { id: 'ogn-001-298', set: 'OGN', number: 1, oracle: 'y', variant: 'base' },
  ];
  assert.deepEqual(printsOf(cards[2], cards).map(c => c.id), ['ogn-255-298', 'ogn-303-star-298', 'opp-255-298-metal']);
  assert.deepEqual(printsOf({ id: 'z' }, cards).map(c => c.id), ['z'], 'no link: the card alone');
  assert.equal(printKindLabel(cards[0]), 'Promo · Metal');
});

test('new printings take the French of another printing of the same card at once (oracle link)', async () => {
  const { frenchFromPrints } = await import('../src/lib/prints.js');
  const catalog = [
    { id: 'ogn-255-298', nameFr: 'Ahri - Renarde à neuf queues', textFr: '<p>Texte</p>' },
    { id: 'ogn-303-298', nameFr: 'Ahri - Renarde à neuf queues', variant: 'overnumbered' },
    { id: 'ogn-001-298', nameFr: 'Brûleur ardent' },
  ];
  const links = [{ id: 'ogn-255-298', oracle: 'x', variant: 'base' }, { id: 'ogn-303-298', oracle: 'x', variant: 'overnumbered' }];
  const out = frenchFromPrints([{ id: 'opp-255-298-metal', oracle: 'x' }, { id: 'opp-999-298', oracle: 'z' }, { id: 'pr-1', oracle: 'x', nameFr: 'Déjà' }], catalog, links);
  assert.deepEqual(out[0], { id: 'opp-255-298-metal', oracle: 'x', nameFr: 'Ahri - Renarde à neuf queues', textFr: '<p>Texte</p>' });
  assert.deepEqual(out[1], { id: 'opp-999-298', oracle: 'z' }, 'no printing in French: as it is');
  assert.equal(out[2].nameFr, 'Déjà', 'a French name already there is kept');
  const cards = read('src/components/settings/CardsUpdate.jsx');
  assert.match(cards, /frenchFromPrints\(cards, m\.cards, result\.links \|\| \[\]\)/);
});

function read(p) { return readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'); }

test('recycle cost (« power ») from rifthunt: on new cards, and written on the others without being a change', () => {
  assert.equal(normalizeRifthuntCard(printing({ power: 3 })).card.power, 3);
  assert.equal(normalizeRifthuntCard(printing({ power: null })).card.power, undefined);
  const catalog = [normalizeRifthuntCard(printing()).card, ...filler.map(p => normalizeRifthuntCard(p).card)];
  const ch = rifthuntChanges([printing({ power: 2 }), ...filler], catalog);
  assert.deepEqual(ch.changed, []);
  assert.equal(ch.links.find(l => l.id === 'ogn-066-298').power, 2);
});
