/* Rulings of Riftbound FAQ through rifthunt (src/lib/rulings.js, content kind « rulings »). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { sanitizeRulingHtml, parseRulings, buildRulings, rulingsFor, rulingsLayer, RULINGS_URL } from '../src/lib/rulings.js';
import { PageReadError } from '../src/lib/banUpdate.js';

const { layerProblem, mergeCatalog } = createRequire(import.meta.url)('../electron/content.cjs');

test('answers: plain tags, links to the FAQ, rifthunt (relative) or playriftbound only, nothing else', () => {
  const html = '<p class="x" onclick="evil()">No. See <a href="/cards/sfd/136/hard-bargain/">Hard Bargain</a>.<sup class="cite"><a href="https://www.riftboundfaq.com/reference/core-rules/1.5#R357.1" title="t">357.1</a></sup></p>'
    + '<h4>Example</h4><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://evil.example/">y</a><img src=x onerror=alert(1)><div>1 < 2</div>';
  assert.equal(sanitizeRulingHtml(html),
    '<p>No. See <a href="https://rifthunt.com/cards/sfd/136/hard-bargain/" target="_blank" rel="noopener noreferrer">Hard Bargain</a>.'
    + '<sup><a href="https://www.riftboundfaq.com/reference/core-rules/1.5#R357.1" target="_blank" rel="noopener noreferrer">357.1</a></sup></p>'
    + '<p>Example</p>alert(1)<a>x</a><a>y</a><p>1 &lt; 2</p>');
  assert.equal(sanitizeRulingHtml('<a href="https://playriftbound.com/en-us/news/x/">r</a>'), '<a href="https://playriftbound.com/en-us/news/x/" target="_blank" rel="noopener noreferrer">r</a>');
  assert.equal(sanitizeRulingHtml('<a href="https://www.riftboundfaq.com/x&quot; onmouseover=&quot;evil">z</a>'), '<a>z</a>', 'an address with an injected attribute is dropped');
  assert.equal(sanitizeRulingHtml(null), '');
});

const bulk = {
  source: 'riftboundfaq.com', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', committedAt: '2026-11-03T15:19:24Z',
  cards: [
    { card: 'Lux, Crownguard', url: 'https://www.riftboundfaq.com/cards/lux-crownguard', authors: [{ name: 'Christian “Near” Ivicevic' }], rulings: [{ id: 'q1', question: 'Can I use Lux to pay for Hard Bargain?', html: '<p>No.</p>' }] },
    { card: 'Akali, Brash', url: 'https://evil.example/', rulings: [{ id: 'q2', question: 'Q?', html: '<p>A.</p>' }] },
    { card: 'Nobody, Unknown', url: 'https://www.riftboundfaq.com/cards/x', rulings: [{ id: 'q3', question: 'Q?', html: '<p>A.</p>' }] },
    { card: 'Empty', rulings: [{ id: 'q4', question: '', html: '' }] },
  ],
};
const catalog = [
  { id: 'ogs-014-024', name: 'Lux', nameEn: 'Lux - Crownguard', type: 'unit', oracle: 'lux' },
  { id: 'opp-014-024', name: 'Lux', type: 'unit', oracle: 'lux', variant: 'promo' },
  { id: 'unl-010-219', name: 'Akali', type: 'unit', oracle: 'akali' },
  { id: 'ogn-001-298', name: 'Blazing Scorcher', type: 'unit' },
];

test('the FAQ cards are found by name (all their printings follow), or through rifthunt\'s printings', () => {
  const byName = buildRulings(bulk, catalog);
  assert.deepEqual(byName.data.cards.map(e => [e.name, e.ids]), [['Lux, Crownguard', ['ogs-014-024', 'opp-014-024']], ['Akali, Brash', []], ['Nobody, Unknown', []]]);
  assert.deepEqual(byName.unknown, ['Akali, Brash', 'Nobody, Unknown', 'Empty']);
  assert.equal(byName.data.cards[1].url, 'https://www.riftboundfaq.com/', 'an address elsewhere is not kept');
  assert.deepEqual(byName.data.cards[0].authors, ['Christian “Near” Ivicevic']);
  assert.equal(byName.data.updatedAt, '2026-11-03');
  const printings = [{ riftboundId: 'unl-010-219', name: 'Akali, Brash', set: 'UNL' }];
  const withRh = buildRulings(bulk, catalog, printings);
  assert.deepEqual(withRh.data.cards.find(e => e.name === 'Akali, Brash').ids, ['unl-010-219'], 'catalog name « Akali » alone: found through rifthunt');
  assert.deepEqual(withRh.unknown, ['Nobody, Unknown', 'Empty']);
  const layer = rulingsLayer(withRh.data, new Date('2026-11-21T00:00:00Z'));
  assert.equal(layer.count, 3);
  assert.throws(() => parseRulings('<html>'), PageReadError);
  assert.throws(() => parseRulings('{"cards": []}'), PageReadError);
});

test('a card sheet finds its rulings, or those of another printing of the same card', () => {
  const { data } = buildRulings(bulk, catalog.slice(0, 1));
  assert.equal(rulingsFor(catalog[0], data, catalog).rulings[0].id, 'q1');
  assert.equal(rulingsFor(catalog[1], data, catalog).name, 'Lux, Crownguard', 'promo printing: through the oracle link');
  assert.equal(rulingsFor(catalog[3], data, catalog), null);
  assert.equal(rulingsFor(catalog[0], null, catalog), null);
});

test('content layer « rulings »: checked, served in the catalog, never removed by a new app version', () => {
  const { data } = buildRulings(bulk, catalog);
  const layer = { ...rulingsLayer(data), kind: 'rulings', format: 1, files: {} };
  assert.equal(layerProblem(layer, 'rulings', '.'), null);
  assert.match(layerProblem({ ...layer, data: { cards: [{ name: 'x', ids: ['../bad'], rulings: [] }] } }, 'rulings', '.'), /ruling invalide/);
  assert.match(layerProblem({ ...layer, data: { cards: [{ name: 'x', ids: [], rulings: [{ question: 'q', html: 'x'.repeat(20001) }] }] } }, 'rulings', '.'), /ruling invalide/);
  const merged = mergeCatalog({ generatedAt: '2026-11-17', cards: [] }, { rulings: layer });
  assert.equal(merged.rulings.cards.length, 3);
  assert.equal(merged.content.rulings.count, 3);
  const src = readFileSync(new URL('../electron/content.cjs', import.meta.url), 'utf8');
  assert.match(src, /if \(kind === 'rulings'\) return false; \/\/ never shipped with the app/);
  assert.match(readFileSync(new URL('../electron/pack.cjs', import.meta.url), 'utf8'), /KINDS = \['cartes', 'traductions', 'bannies', 'rulings'\]/, 'a friend\'s pack can carry them');
  const { allowed } = createRequire(import.meta.url)('../electron/contentFetch.cjs');
  assert.ok(allowed(RULINGS_URL));
});
