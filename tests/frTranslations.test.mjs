// Lot 4.3: « Mettre à jour les traductions françaises » (riftboundfr.fr files).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import './helpers.mjs';

const F = await import('../src/lib/frTranslations.js');
const require = createRequire(import.meta.url);
const { fetchContent } = require('../electron/contentFetch.cjs');

const cards = [
  { id: 'ogn-001-298', name: 'Blazing Scorcher', type: 'unit', nameFr: 'Terreur enflammée', textFr: 'Ancien texte' },
  { id: 'ogn-002-298', name: 'Brazen Buccaneer', type: 'unit' },
  { id: 'ogn-299-star-298', name: "Kai'Sa", nameEn: "Kai'Sa - Daughter of the Void", type: 'legend' },
  { id: 'ogn-299-298', name: "Kai'Sa", nameEn: "Kai'Sa - Daughter of the Void", type: 'legend' },
];
const repertoire = { v: 1, c: [
  { i: 'u1', b: 'ogn-001-298', n: 'Terreur enflammée' },
  { i: 'u2', b: 'ogn-002-298', n: 'Corsaire  téméraire (Alternate Art)' },
  { i: 'u3', b: 'ogn-299*-298', n: 'Kai\'Sa - Fille du Néant' },
  { i: 'u4', b: 'jdg-059-221', n: 'Carte de juge' },
] };
const textes = { v: 1, t: {
  u1: { fr: 'Nouveau texte <b>gras</b>' },
  u2: { fr: 'Texte <img src=x onerror=alert(1)><script>alert(2)</script> fin' },
} };

test('the two files are recognised; any other format is refused', () => {
  assert.equal(F.readFrFile(JSON.stringify(repertoire)).kind, 'repertoire');
  assert.equal(F.readFrFile(JSON.stringify(textes)).kind, 'textes');
  assert.throws(() => F.readFrFile('{"cards": []}'), /ne vient pas de riftboundfr\.fr/);
  assert.throws(() => F.readFrFile('<html>Payment required</html>'), /ne vient pas de riftboundfr\.fr/);
  assert.throws(() => F.readFrFile('{"c": "pas une liste"}'), /format inattendu/);
});

test('join by card id (star prints), print suffix dropped, other prints completed, unknown cards counted', () => {
  const tr = F.buildTranslations(repertoire, textes, cards);
  assert.equal(tr.names['ogn-002-298'], 'Corsaire téméraire');
  assert.equal(tr.names['ogn-299-star-298'], "Kai'Sa - Fille du Néant");
  assert.equal(tr.names['ogn-299-298'], "Kai'Sa - Fille du Néant", 'print without French data: from the other print');
  assert.equal(tr.unknown, 1, 'the judge card is not in the catalog: ignored and counted');
  const ch = F.translationChanges(tr, cards);
  assert.deepEqual(ch.names, ['ogn-002-298', 'ogn-299-star-298', 'ogn-299-298']);
  assert.deepEqual(ch.texts, ['ogn-001-298', 'ogn-002-298']);
  assert.equal(F.changesText(ch), '3 noms et 2 textes nouveaux ou modifiés.');
  assert.equal(F.changesText({ names: [], texts: [] }), 'Les traductions sont à jour.');
});

test('texts with active HTML are cleaned (sanitizeHtml); names are plain text', () => {
  const tr = F.buildTranslations(repertoire, textes, cards);
  assert.equal(tr.texts['ogn-001-298'], 'Nouveau texte <b>gras</b>');
  assert.equal(tr.texts['ogn-002-298'], 'Texte alert(2) fin');
  const evil = F.buildTranslations({ c: [{ i: 'x', b: 'ogn-001-298', n: '<script>Terreur</script>' }] }, { t: {} }, cards);
  assert.equal(evil.names['ogn-001-298'], 'Terreur');
});

test('layer for electron/content.cjs, with the source', () => {
  const l = F.translationLayer(F.buildTranslations(repertoire, textes, cards), new Date('2026-11-18T10:00:00Z'));
  assert.equal(l.source.label, 'riftboundfr.fr');
  assert.equal(l.count, 4);
  assert.equal(l.createdAt, '2026-11-18T10:00:00.000Z');
});

test('the site down (402, as on 18/11/2026) is « unavailable », not a refusal', async () => {
  const down = async () => new Response('Payment required\n\nDEPLOYMENT_DISABLED', { status: 402, headers: { 'content-type': 'text/plain' } });
  const r = await fetchContent(F.FR_URLS[0], { fetchImpl: down });
  assert.deepEqual(r, { ok: false, reason: 'unavailable', status: 402 });
});

test('a printing without French takes the one of a printing linked by rifthunt (oracle), else by name', () => {
  const cards = [
    { id: 'ogn-255-298', name: 'Ahri', nameEn: 'Ahri - Nine-Tailed Fox', type: 'unit', oracle: 'x' },
    { id: 'opp-255-298-metal', name: 'Ahri', nameEn: 'Ahri - Nine-Tailed Fox (Metal)', type: 'unit', oracle: 'x' },
    { id: 'ogn-001-298', name: 'Blazing Scorcher', type: 'unit' },
    { id: 'sfd-001-221', name: 'Blazing Scorcher', type: 'unit' },
  ];
  const repertoire = { c: [{ i: 'a', b: 'ogn-255-298', n: 'Ahri - Renarde à neuf queues' }, { i: 'b', b: 'ogn-001-298', n: 'Brûleur ardent' }] };
  const tr = F.buildTranslations(repertoire, { t: { a: { fr: 'Texte' } } }, cards);
  assert.equal(tr.names['opp-255-298-metal'], 'Ahri - Renarde à neuf queues', 'oracle link, though the English names differ');
  assert.equal(tr.texts['opp-255-298-metal'], 'Texte');
  assert.equal(tr.names['sfd-001-221'], 'Brûleur ardent', 'no link: same type and name');
});
