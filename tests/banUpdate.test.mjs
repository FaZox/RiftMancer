// Lot 4.4: « Mettre à jour les cartes bannies » — simulated Riot pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import './helpers.mjs';

const B = await import('../src/lib/banUpdate.js');
const require = createRequire(import.meta.url);
const { fetchContent, allowed, looksRefused } = require('../electron/contentFetch.cjs');

/** A page built like playriftbound.com (Next.js: the article in __NEXT_DATA__). */
const nextPage = (body) => `<html><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { page: { blades: [{ type: 'x' }, { richText: { body } }] } } } })}</script></body></html>`;
const rulesBody = (date = 'December 1, 2026', extra = '') => `<h3>Introduction</h3><p>Hello</p>
<h3>Constructed Format Legality</h3><p><i>Last updated: ${date}</i></p><p>The following are banned:</p>
<figure><table><tbody><tr><td><h4>Cards</h4><ul><li>Called Shot</li><li>Ekko, Recurrent</li>${extra}</ul></td>
<td><h4>Battlefields</h4><ul><li>Dreaming Tree</li></ul></td></tr></tbody></table></figure>
<h3>2v2 Constructed Legality</h3><p><i>Last updated: ${date}</i></p>
<figure><table><tbody><tr><td><h3>Legends</h3><ul><li aria-level="1">Master Yi, Wuju Bladesman</li></ul></td><td><h3>Cards</h3><ul><li>Called Shot</li><li>Ekko, Recurrent</li>${extra}</ul></td>
<td><h3>Battlefields</h3><ul><li>Dreaming Tree</li></ul></td></tr></tbody></table></figure>
<h3>Core Rules</h3><p>Rules (<i>last updated: October 9, 2026</i>)</p><ul><li>Not a card</li></ul>`;

const cards = [
  { id: 'sfd-122-221', name: 'Called Shot', type: 'spell' },
  { id: 'ogn-110-298', name: 'Ekko', nameEn: 'Ekko - Recurrent', type: 'unit' },
  { id: 'ogn-292-298', name: 'The Dreaming Tree', type: 'battlefield' },
  { id: 'ogs-001-024', name: 'Master Yi', nameEn: 'Master Yi - Wuju Bladesman', type: 'legend' },
  { id: 'unl-050-219', name: 'Stacked Deck', type: 'spell' },
];
const current = {
  version: 2, updatedAt: '2026-11-23', sources: [],
  formats: {
    standard: { label: 'Standard', banned: [
      { name: 'Called Shot', since: '2026-09-18' }, { name: 'Ekko, Recurrent', ids: ['ogn-110-298'], since: '2026-09-18' },
      { name: 'Dreaming Tree', ids: ['ogn-292-298'], battlefield: true, since: '2026-09-18' },
      { name: 'Stacked Deck', since: '2026-11-23' }], restricted: {} },
    '2v2': { label: '2v2', banned: [{ name: 'Called Shot', since: '2026-09-18' }], restricted: {} },
  },
};

test('rules page read: lists per format, date, nothing from the next sections', () => {
  const r = B.parseRulesPage(nextPage(rulesBody()));
  assert.equal(r.updatedAt, '2026-12-01');
  assert.deepEqual(r.formats.standard, { cards: ['Called Shot', 'Ekko, Recurrent'], battlefields: ['Dreaming Tree'], legends: [] });
  assert.deepEqual(r.formats['2v2'].legends, ['Master Yi, Wuju Bladesman']);
  assert.equal(B.isoDate('Effective: November 23, 2026'), '2026-11-23');
});

test('unexpected page structure: an error, nothing built', () => {
  assert.throws(() => B.parseRulesPage(nextPage('<h3>Something else</h3><ul><li>Called Shot</li></ul>')), B.PageReadError);
  assert.throws(() => B.parseRulesPage('<script id="__NEXT_DATA__">{pas du json</script>'), /n’a pas pu être lue/);
  assert.throws(() => B.parseBanAnnouncement(nextPage('<p>Nothing here</p>')), B.PageReadError);
});

test('new list: page names matched to the catalog, prints listed for champions, a newer page lifts what it no longer lists', () => {
  const rules = B.parseRulesPage(nextPage(rulesBody('December 1, 2026', '<li>Riven, Broken Blade</li>')));
  const { list, unknown } = B.buildBanList(current, rules, null, cards);
  const std = list.formats.standard.banned;
  assert.deepEqual(std.map(e => e.name), ['Called Shot', 'Ekko, Recurrent', 'Riven, Broken Blade', 'Dreaming Tree']);
  assert.deepEqual(std[1], current.formats.standard.banned[1], 'existing entry kept as it was');
  assert.equal(std[2].since, '2026-12-01');
  assert.deepEqual(unknown, ['Riven, Broken Blade'], 'name not in the catalog: reported');
  const yi = list.formats['2v2'].banned.find(e => e.legend);
  assert.deepEqual(yi, { name: 'Master Yi, Wuju Bladesman', ids: ['ogs-001-024'], legend: true, since: '2026-12-01' });
  const d = B.diffBans(current, list);
  assert.deepEqual(d.formats.standard, { added: ['Riven, Broken Blade'], removed: ['Stacked Deck'] }, 'the 1 Dec. page no longer lists Stacked Deck');
  assert.deepEqual(d.formats['2v2'].added, ['Master Yi, Wuju Bladesman', 'Ekko, Recurrent', 'Riven, Broken Blade', 'Dreaming Tree']);
  assert.equal(list.updatedAt, '2026-12-01');
  assert.equal(list.sources.at(-1).url, B.RULES_URL);
});

test('an older rules page lifts nothing announced after it; a card removed from it is lifted', () => {
  const rules = B.parseRulesPage(nextPage(rulesBody('September 18, 2026').replace('<li>Ekko, Recurrent</li>', '')));
  const { list } = B.buildBanList(current, rules, null, cards);
  const d = B.diffBans(current, list);
  assert.deepEqual(d.formats.standard, { added: [], removed: ['Ekko, Recurrent'] }, 'Stacked Deck (announced 23/11) stays');
});

test('announcement: cards « being added », effective date', () => {
  const html = nextPage(`<p><b>Effective</b>: November 23, 2026</p><p>Two cards are being added to the Standard and 2v2 Constructed ban list:</p>
    <h4>Cards</h4><ul><li>Stacked Deck</li><li>Zhonya’s Hourglass</li></ul><h4>Battlefields</h4><ul><li>Star Spring</li></ul><p>Why</p><h3>Riven</h3><ul><li>43% of decks</li></ul>`);
  const a = B.parseBanAnnouncement(html);
  assert.deepEqual(a, { effective: '2026-11-23', formats: ['standard', '2v2'], cards: ['Stacked Deck', "Zhonya's Hourglass"], battlefields: ['Star Spring'], legends: [] });
  const rules = B.parseRulesPage(nextPage(rulesBody('September 18, 2026')));
  const { list } = B.buildBanList(current, rules, { ...a, url: 'https://playriftbound.com/en-us/news/announcements/x' }, cards);
  assert.deepEqual(B.diffBans(current, list).formats.standard.added, ["Zhonya's Hourglass", 'Star Spring']);
  assert.ok(list.formats.standard.banned.find(e => e.name === 'Star Spring').battlefield);
});

test('an empty or much shorter list is a reading error, never lifted bans', () => {
  const empty = { formats: { standard: { banned: [] } } };
  assert.match(B.banListProblem(current, empty), /vide/);
  assert.match(B.banListProblem(current, { formats: { standard: { banned: [{ name: 'a' }] } } }), /moins de la moitié/);
  assert.equal(B.banListProblem(current, current), null);
});

test('manual edit: add with the typed date, remove', () => {
  let l = B.editBanList(current, { format: 'standard', date: '2026-12-05', add: [{ name: 'Star Spring', battlefield: true }] });
  assert.deepEqual(l.formats.standard.banned.at(-1), { name: 'Star Spring', ids: undefined, battlefield: true, since: '2026-12-05' });
  assert.equal(l.updatedAt, '2026-12-05');
  l = B.editBanList(l, { format: 'standard', remove: ['Called Shot'] });
  assert.deepEqual(B.diffBans(current, l).formats.standard, { added: ['Star Spring'], removed: ['Called Shot'] });
  assert.equal(current.formats.standard.banned.length, 4, 'current list untouched');
  const layer = B.banLayer(l, { label: 'modification à la main' }, new Date('2026-12-05T10:00:00Z'));
  assert.equal(layer.count, 5);
});

test('downloads: allowed addresses only, honest, refusals and offline reported', async () => {
  assert.equal(allowed(B.RULES_URL), true);
  assert.equal(allowed('https://riftboundfr.fr/textes-cartes.json'), true);
  assert.equal(allowed('https://example.com/x'), false);
  assert.equal(allowed('http://playriftbound.com/en-us/news/a/b'), false, 'https only');
  assert.deepEqual(await fetchContent('https://evil.example/banlist'), { ok: false, reason: 'forbidden-url' });
  const res = (status, body, headers = {}) => async (url, opts) => {
    res.seen = opts;
    return new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } });
  };
  let r = await fetchContent(B.RULES_URL, { version: '2.1.0', fetchImpl: res(200, '<html>ok</html>', { etag: 'W/"1"' }) });
  assert.equal(r.ok, true);
  assert.equal(r.etag, 'W/"1"');
  assert.match(res.seen.headers['User-Agent'], /^RiftMancer\/2\.1\.0/, 'says who it is');
  r = await fetchContent(B.RULES_URL, { etag: 'W/"1"', fetchImpl: res(304, null) });
  assert.equal(r.notModified, true);
  assert.equal(res.seen.headers['If-None-Match'], 'W/"1"');
  assert.equal((await fetchContent(B.RULES_URL, { fetchImpl: res(403, 'no') })).reason, 'refused');
  assert.equal((await fetchContent(B.RULES_URL, { fetchImpl: res(200, '<title>Just a moment...</title>') })).reason, 'refused');
  assert.equal((await fetchContent(B.RULES_URL, { fetchImpl: res(500, 'x') })).reason, 'http');
  assert.equal((await fetchContent(B.RULES_URL, { fetchImpl: async () => { throw new Error('ENOTFOUND'); } })).reason, 'offline');
  assert.equal(looksRefused(200, 'application/json', '{"captcha": 1}'), false, 'only an HTML page is a challenge');
});
