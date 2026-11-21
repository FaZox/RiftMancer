// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
// Official ban list (public/banlist.json, lot 1.1): formats, effective dates, every name in the catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadCatalog } from './helpers.mjs';

await loadCatalog();
const { validateDeck, banStatus, banListInfo, deckFormats } = await import('../src/lib/deckRules.js');
const { setBanlist } = await import('../src/lib/banlist.js');
const { getMatcher } = await import('../src/lib/cardMatcher.js');
const BAN = JSON.parse(fs.readFileSync(new URL('../public/banlist.json', import.meta.url), 'utf8'));
const cards = JSON.parse(fs.readFileSync(new URL('../public/card-hashes.json', import.meta.url), 'utf8')).cards;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Jinx, Loose Cannon + her champion: a legal start, then the card under test
const deck = (extra, format) => ({ legendId: 'ogn-251-298', championId: 'ogn-030-298', format, cards: [
  { cardId: 'ogn-030-298', zone: 'main', quantity: 1 }, ...extra] });

test('every name of the ban list is in the catalog (with all its prints)', () => {
  for (const [f, def] of Object.entries(BAN.formats)) {
    for (const e of def.banned) {
      assert.equal(typeof e, 'object', `${f} : entrée ${e}`);
      assert.match(e.since, /^\d{4}-\d{2}-\d{2}$/, `${f} : date de ${e.name}`);
      if (e.ids) {
        assert.ok(e.ids.length, `${f} : ${e.name} sans identifiant`);
        for (const id of e.ids) assert.ok(cards.some(c => c.id === id), `${f} : ${e.name} → ${id} absent du catalogue`);
        // all prints: every card with the same English name and French title is listed
        const ref = cards.find(c => c.id === e.ids[0]);
        const same = cards.filter(c => c.name === ref.name && c.nameFr === ref.nameFr && c.type === ref.type).map(c => c.id).sort();
        assert.deepEqual([...e.ids].sort(), same, `${f} : impressions de ${e.name}`);
      } else {
        assert.ok(cards.some(c => norm(c.name) === norm(e.name)), `${f} : ${e.name} introuvable dans le catalogue`);
      }
    }
  }
});

test('Called Shot is an error in Standard', () => {
  setBanlist(BAN);
  try {
    const called = cards.find(c => c.name === 'Called Shot');
    const r = validateDeck(deck([{ cardId: called.id, zone: 'main', quantity: 1 }]), { date: '2026-11-17' });
    assert.equal(r.format, 'standard');
    assert.match(r.errors.join('\n'), /bannie/);
  } finally { setBanlist(null); }
});

test('Master Yi, Wuju Bladesman: banned in 2v2 only', () => {
  setBanlist(BAN);
  try {
    const yi = getMatcher().getCardData('ogs-019-024');
    assert.equal(banStatus(yi, BAN, 'standard', '2026-11-17'), null);
    assert.equal(banStatus(yi, BAN, '2v2', '2026-11-17')?.banned, true);
    const d = { legendId: 'ogs-019-024', cards: [] };
    assert.doesNotMatch(validateDeck({ ...d, format: 'standard' }, { date: '2026-11-17' }).errors.join('\n'), /bannie/);
    assert.match(validateDeck({ ...d, format: '2v2' }, { date: '2026-11-17' }).errors.join('\n'), /bannie/);
  } finally { setBanlist(null); }
});

test('a ban counts from its effective date (Radiance list, 23 Nov 2026)', () => {
  const zhonya = getMatcher().getCardData(cards.find(c => c.name === "Zhonya's Hourglass").id);
  assert.equal(banStatus(zhonya, BAN, 'standard', '2026-11-22'), null);
  assert.equal(banStatus(zhonya, BAN, 'standard', '2026-11-23')?.banned, true);
  const before = banListInfo('standard', BAN, '2026-11-17');
  assert.equal(before.date, '2026-09-18');
  assert.equal(before.count, 12);
  assert.deepEqual(before.upcoming.map(u => [u.since, u.names.length]), [['2026-11-23', 10]]);
  assert.equal(banListInfo('standard', BAN, '2026-11-23').date, '2026-11-23');
});

test('champions: only the banned title, not every print of the champion', () => {
  const m = getMatcher();
  assert.equal(banStatus(m.getCardData('ogn-110-298'), BAN, 'standard', '2026-11-17')?.banned, true); // Ekko, Recurrent
  assert.equal(banStatus(m.getCardData('rad-021-167'), BAN, 'standard', '2026-11-17'), null); // Ekko, Revolutionary
  assert.equal(banStatus(m.getCardData('sfd-020a-221'), BAN, 'standard', '2026-11-17')?.banned, true); // Draven, Vanquisher (alt.)
});

test('formats: Standard and 2v2, unknown format → Standard', () => {
  assert.deepEqual(deckFormats(BAN).map(f => f.id), ['standard', '2v2']);
  setBanlist(BAN);
  try { assert.equal(validateDeck(deck([], 'vintage')).format, 'standard'); } finally { setBanlist(null); }
});

test('a card banned on a later date is announced, not an error yet', () => {
  setBanlist(BAN);
  try {
    const z = cards.find(c => c.name === "Zhonya's Hourglass").id;
    const r = validateDeck(deck([{ cardId: z, zone: 'main', quantity: 1 }]), { date: '2026-11-17' });
    assert.doesNotMatch(r.errors.join('\n'), /bannie/);
    assert.match(r.warnings.join('\n'), /sera bannie à partir du 23 nov\. 2026/);
    assert.ok(validateDeck(deck([{ cardId: z, zone: 'main', quantity: 1 }]), { date: '2026-11-23' }).bannedIds.has(z));
  } finally { setBanlist(null); }
});

test('Réglages → Contenu: summary of the banned list (B.6.1)', async () => {
  const { banSummary } = await import('../src/lib/banlist.js');
  const list = { formats: {
    standard: { banned: ['Called Shot', { name: 'Ekko, Recurrent', ids: ['ogn-110-298'] }, { name: "Reaver's Row", battlefield: true }] },
    '2v2': { banned: ['Called Shot', { name: 'Master Yi, Wuju Bladesman' }] },
  } };
  assert.deepEqual(banSummary(list), { cards: 2, battlefields: 1, extra2v2: 1, text: 'Standard : 2 cartes, 1 champ de bataille · 2v2 : +1' });
  assert.equal(banSummary(null).text, 'Standard : 0 carte');
});
