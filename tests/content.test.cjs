/* Lot 4.1: catalog in layers (electron/content.cjs). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createContent, mergeCatalog } = require('../electron/content.cjs');

/** A small « dist » (base) and an empty userData/catalogue. */
function setup({ generatedAt = '2026-11-17T19:00:00.000Z', banDate = '2026-11-17' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-content-'));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(dist, 'card-hashes.json'), JSON.stringify({
    gridSize: 16, generatedAt, embeddings: { modelSha256: 'm' },
    cards: [
      { id: 'ogn-001-298', name: 'Blazing Scorcher', nameFr: 'Terreur enflammée', setName: 'Origins', f: 'AAA' },
      { id: 'ogn-002-298', name: 'Brazen Buccaneer', setName: 'Origins', f: 'BBB' },
      { id: 'man-001', name: 'Manual card', setName: 'Origins', f: 'CCC' },
    ],
  }));
  fs.writeFileSync(path.join(dist, 'banlist.json'), JSON.stringify({ version: 2, updatedAt: banDate, formats: { standard: { banned: [{ name: 'Called Shot' }] } } }));
  return { root, dist, content: createContent({ dir: path.join(root, 'catalogue'), distDir: dist }) };
}
const newCard = { id: 'vnd-001-221', name: 'New Card', setName: 'Vendetta', f: 'DDD', e: 'EEE' };
const cardsLayer = (createdAt = '2026-11-18T10:00:00.000Z') => ({
  createdAt, source: { label: 'galerie officielle Riot' }, count: 1,
  data: { cards: [newCard], removed: ['man-001'] },
});
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

test('no layer: the base is served as is', () => {
  const { content } = setup();
  const s = content.rebuild();
  assert.equal(s.cards, 3);
  assert.equal(content.resolve('/card-hashes.json'), null);
  assert.equal(content.resolve('/banlist.json'), null);
  assert.deepEqual(s.messages, []);
});

test('cards layer: new card added, manual card made official removed, image served from the layer', () => {
  const { content } = setup();
  const img = Buffer.from('RIFF....WEBP');
  const s = content.install('cartes', cardsLayer(), { 'cards/vnd-001-221.webp': img, 'cards/thumbs/vnd-001-221.webp': img });
  assert.equal(s.cards, 3);
  assert.equal(s.lastSet, 'Vendetta');
  const merged = read(content.resolve('/card-hashes.json'));
  assert.deepEqual(merged.cards.map(c => c.id), ['ogn-001-298', 'ogn-002-298', 'vnd-001-221']);
  assert.equal(merged.generatedAt, '2026-11-18T10:00:00.000Z', 'newer than the base: the phone takes it (catalogChoice)');
  assert.deepEqual(merged.embeddings, { modelSha256: 'm' }, 'same AI header');
  assert.equal(merged.content.cartes.count, 1);
  assert.ok(content.resolve('/cards/vnd-001-221.webp').endsWith(path.join('cartes', 'cards', 'vnd-001-221.webp')));
  assert.ok(content.resolve('/cards/thumbs/vnd-001-221.webp'));
  assert.equal(content.resolve('/cards/ogn-001-298.webp'), null, 'base images stay in dist');
  assert.equal(content.resolve('/cards/../../secret.webp'), null);
});

test('translations layer: French names and texts over the catalog', () => {
  const { content } = setup();
  const s = content.install('traductions', {
    createdAt: '2026-11-18T10:00:00.000Z', source: { label: 'riftboundfr.fr' }, count: 2,
    data: { names: { 'ogn-002-298': 'Corsaire téméraire' }, texts: { 'ogn-002-298': 'Texte' } },
  });
  assert.equal(s.namesFr, 2);
  const merged = read(content.resolve('/card-hashes.json'));
  assert.equal(merged.cards[1].nameFr, 'Corsaire téméraire');
  assert.equal(merged.cards[0].nameFr, 'Terreur enflammée', 'others untouched');
});

test('banned cards layer: served instead of the base list; previous list restorable', () => {
  const { content } = setup();
  const list = (d, names) => ({ createdAt: `${d}T10:00:00.000Z`, data: { version: 2, updatedAt: d, formats: { standard: { banned: names.map(name => ({ name })) } } } });
  content.install('bannies', list('2026-11-23', ['Called Shot', 'Stacked Deck']));
  assert.equal(read(content.resolve('/banlist.json')).formats.standard.banned.length, 2);
  content.install('bannies', list('2026-12-01', ['Called Shot']));
  assert.equal(content.status().previous.bannies, true);
  const s = content.restorePrevious('bannies');
  assert.equal(s.banlist.updatedAt, '2026-11-23');
  content.restorePrevious('bannies'); // no previous any more: back to the base
  assert.equal(content.resolve('/banlist.json'), null);
});

test('an invalid layer is ignored with a message, never silently', () => {
  const { content, root } = setup();
  content.install('cartes', cardsLayer(), { 'cards/vnd-001-221.webp': Buffer.from('x') });
  fs.writeFileSync(path.join(root, 'catalogue', 'couches', 'cartes', 'cards', 'vnd-001-221.webp'), 'modifié');
  const s = content.rebuild();
  assert.equal(s.cards, 3);
  assert.equal(content.resolve('/card-hashes.json'), null);
  assert.deepEqual(s.messages, [{ kind: 'cartes', tone: 'bad', text: 'Cartes : mise à jour ignorée (fichier altéré (cards/vnd-001-221.webp)).' }]);
  fs.writeFileSync(path.join(root, 'catalogue', 'couches', 'cartes', 'layer.json'), '{pas du json');
  assert.match(content.rebuild().messages[0].text, /fichier illisible/);
});

test('install refuses a bad layer and changes nothing', () => {
  const { content } = setup();
  assert.throws(() => content.install('cartes', { ...cardsLayer(), data: { cards: [{ id: '../x', name: 'x', f: 'x' }] } }), /carte invalide/);
  assert.throws(() => content.install('cartes', cardsLayer(), { '../../evil.webp': Buffer.from('x') }), /Nom de fichier refusé/);
  assert.throws(() => content.install('traductions', { createdAt: '2026-11-18', data: { names: { 'ogn-001-298': 'x'.repeat(5000) }, texts: {} } }), /traduction invalide/);
  assert.throws(() => content.install('autre', cardsLayer()), /Type de contenu inconnu/);
  assert.equal(content.status().layers.cartes, null);
});

test('« Revenir au contenu d’origine » removes every layer', () => {
  const { content } = setup();
  content.install('cartes', cardsLayer(), { 'cards/vnd-001-221.webp': Buffer.from('x') });
  content.install('bannies', { createdAt: '2026-11-23T10:00:00.000Z', data: { version: 2, updatedAt: '2026-11-23', formats: { standard: { banned: [] } } } });
  const s = content.reset();
  assert.deepEqual(s.layers, { cartes: null, traductions: null, bannies: null });
  assert.equal(content.resolve('/card-hashes.json'), null);
  assert.equal(content.resolve('/banlist.json'), null);
  assert.equal(content.resolve('/cards/vnd-001-221.webp'), null);
});

test('a new app version with a more recent base removes the older layers', () => {
  const a = setup();
  a.content.install('cartes', cardsLayer('2026-11-18T10:00:00.000Z'), { 'cards/vnd-001-221.webp': Buffer.from('x') });
  a.content.install('bannies', { createdAt: '2026-11-18T10:00:00.000Z', data: { version: 2, updatedAt: '2026-11-23', formats: { standard: { banned: [] } } } });
  // the app is updated: its base is from December, its banned list from the 23rd
  fs.writeFileSync(path.join(a.dist, 'card-hashes.json'), JSON.stringify({ ...read(path.join(a.dist, 'card-hashes.json')), generatedAt: '2026-12-01T00:00:00.000Z' }));
  fs.writeFileSync(path.join(a.dist, 'banlist.json'), JSON.stringify({ version: 2, updatedAt: '2026-11-23', formats: { standard: { banned: [] } } }));
  const s = a.content.rebuild();
  assert.deepEqual(s.layers, { cartes: null, traductions: null, bannies: null });
  assert.equal(s.messages.length, 2);
  assert.match(s.messages[0].text, /déjà dans cette version de l’appli, elle a été retirée/);
  assert.equal(fs.existsSync(path.join(a.root, 'catalogue', 'couches', 'cartes')), false);
});

test('mergeCatalog keeps the base untouched', () => {
  const base = { generatedAt: '2026-11-17', cards: [{ id: 'a-01', name: 'A', f: 'x' }] };
  const out = mergeCatalog(base, { cartes: { createdAt: '2026-11-18', data: { cards: [{ id: 'a-01', name: 'A2', f: 'y' }] } } });
  assert.equal(out.cards[0].name, 'A2');
  assert.equal(base.cards[0].name, 'A');
});

test('the local server serves the merged catalog, the layer images and their versions (phone sync)', async () => {
  const { createServer } = require('../electron/server.cjs');
  const crypto = require('node:crypto');
  const { content, dist } = setup();
  fs.writeFileSync(path.join(dist, 'index.html'), '<html></html>');
  const api = createServer({ store: null, distDir: dist, getName: () => 'pc', onSynced: () => {}, getPrices: () => null, content });
  const before = api.catalogVersion();
  content.install('cartes', cardsLayer(), { 'cards/vnd-001-221.webp': Buffer.from('IMAGE') });
  await new Promise(r => api.server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${api.server.address().port}`;
    const catalog = await (await fetch(`${base}/card-hashes.json?v=1`)).text();
    assert.equal(JSON.parse(catalog).cards.at(-1).id, 'vnd-001-221');
    const version = api.catalogVersion();
    assert.notEqual(version, before, 'the phone sees a new catalog');
    assert.equal(version, crypto.createHash('sha256').update(catalog).digest('hex'), 'and can check what it downloads');
    const img = await fetch(`${base}/cards/vnd-001-221.webp`);
    assert.equal(img.status, 200);
    assert.equal(await img.text(), 'IMAGE');
    assert.equal(img.headers.get('cache-control'), 'no-cache', 'a changed card image is not kept a day in cache');
  } finally {
    api.server.close();
  }
});

test('cards layer: corrections (patches) and new cards added on top of the previous layer', () => {
  const { content } = setup();
  content.install('cartes', cardsLayer(), { 'cards/vnd-001-221.webp': Buffer.from('A') });
  const s = content.installCards({
    createdAt: '2026-11-19T10:00:00.000Z', source: { label: 'galerie officielle Riot' },
    data: { cards: [{ id: 'vnd-002-221', name: 'Second', setName: 'Vendetta', f: 'EEE' }], patches: [{ id: 'ogn-002-298', nameEn: 'Brazen Buccaneer, Pirate', artGroup: 'ogn-001-298' }, { id: 'ogn-001-298', artGroup: 'ogn-001-298' }] },
  }, { 'cards/vnd-002-221.webp': Buffer.from('B') });
  const merged = read(content.resolve('/card-hashes.json'));
  assert.deepEqual(merged.cards.map(c => c.id), ['ogn-001-298', 'ogn-002-298', 'vnd-001-221', 'vnd-002-221'], 'first new card kept, manual card still removed');
  assert.equal(merged.cards[1].nameEn, 'Brazen Buccaneer, Pirate');
  assert.equal(merged.cards[1].artGroup, 'ogn-001-298');
  assert.ok(content.resolve('/cards/vnd-001-221.webp'), 'image of the previous layer kept');
  assert.ok(content.resolve('/cards/vnd-002-221.webp'));
  assert.equal(s.cards, 4);
  // a patch to null removes the field (card leaving a reprint group)
  content.installCards({ createdAt: '2026-11-20T10:00:00.000Z', data: { cards: [], patches: [{ id: 'ogn-001-298', artGroup: null }] } });
  assert.equal(read(content.resolve('/card-hashes.json')).cards[0].artGroup, undefined);
  // corrections are checked
  assert.throws(() => content.installCards({ createdAt: '2026-11-21T10:00:00.000Z', data: { cards: [], patches: [{ id: 'ogn-001-298', f: 'pirate' }] } }), /correction refusée/);
  assert.throws(() => content.installCards({ createdAt: '2026-11-21T10:00:00.000Z', data: { cards: [], patches: [{ id: 'ogn-001-298', energy: '5' }] } }), /correction refusée/);
});
