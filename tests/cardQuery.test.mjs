// « Cartes » tab (ONGLET-CARTES 1.4): the search line — keys, operators, negation, quotes, aliases, filters ↔ text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const Q = await import('../src/lib/cardQuery.js');
const { parseQuery, compileQuery, selectionFor, setSelection, toggleOption, toggleFlag, removeToken, hasKeys, tokenLabel, canonValue, numTerm, setNumQuery } = Q;

const card = (o) => ({ set: 'OGN', setName: 'Origins', rarity: 'common', type: 'unit', domains: ['fury'], energy: 2, might: 3, ...o });
const CARDS = [
  card({ id: 'a', name: 'Jinx', code: 'OGN-001/298', collectorNumber: '001', energy: 3, might: 4, rarity: 'rare', superTypes: ['champion'], text: '<p>Draw 1 at the start.</p>' }),
  card({ id: 'b', name: 'Noxus Guard', code: 'OGN-118/298', collectorNumber: '118', domains: ['mind'], energy: 1, might: 5 }),
  card({ id: 'c', name: 'Fireball', code: 'OGN-200/298', collectorNumber: '200', type: 'spell', energy: 0, might: null, rarity: 'epic' }),
  card({ id: 'd', name: 'Sword', code: 'SFD-010/221', collectorNumber: '010', set: 'SFD', setName: 'Spiritforged', type: 'gear', domains: ['calm', 'mind'], energy: 7, might: null, rarity: 'uncommon' }),
  card({ id: 'e', name: 'Promo Jinx', code: 'OGN-R01', collectorNumber: 'R01', energy: 9, might: 8, rarity: 'showcase' }),
];
const FR = { a: { nameFr: 'Jinx', textFr: 'Piochez 1 au début du tour.' }, b: { nameFr: 'Garde de Noxus' }, c: { nameFr: 'Boule de feu' } };
const OWNED = { a: 2, d: 1 };
const ctx = { extra: (c) => FR[c.id], owned: (c) => OWNED[c.id] || 0, banned: (c) => c.id === 'b', inDeck: (c) => c.id === 'c', foil: (c) => c.rarity !== 'common' };
const run = (q) => CARDS.filter(compileQuery(parseQuery(q), ctx)).map(c => c.id).join('');

test('empty query and plain text: French or English name, accents and case ignored, number', () => {
  assert.equal(run(''), 'abcde');
  assert.equal(run('   '), 'abcde');
  assert.equal(run('garde'), 'b');
  assert.equal(run('NOXUS'), 'b');
  assert.equal(run('boule'), 'c');
  assert.equal(run('BOULÉ'), 'c');
  assert.equal(run('118'), 'b');
  assert.equal(run('OGN-118'), 'b');
  assert.equal(run('jinx -promo'), 'a');
});

test('each key with its French and English aliases', () => {
  assert.equal(run('t:unité'), 'abe');
  assert.equal(run('type:spell'), 'c');
  assert.equal(run('t:champion'), 'a');
  assert.equal(run('t:équipement'), 'd');
  assert.equal(run('d:esprit'), 'bd');
  assert.equal(run('domaine:fury'), 'ace');
  assert.equal(run('e=0'), 'c');
  assert.equal(run('énergie:1'), 'b');
  assert.equal(run('cost<=1'), 'bc');
  assert.equal(run('p>=4'), 'abe');
  assert.equal(run('puissance:5'), 'b');
  assert.equal(run('might<4'), '', 'cards without might are never matched');
  assert.equal(run('r:rare'), 'a');
  assert.equal(run('rareté:peu-commune'), 'd');
  assert.equal(run('r:"peu commune"'), 'd');
  assert.equal(run('s:sfd'), 'd');
  assert.equal(run('set:ogn'), 'abce');
  assert.equal(run('o:pioche'), 'a');
  assert.equal(run('o:draw'), 'a');
  assert.equal(run('texte:"au début"'), 'a');
  assert.equal(run('n:118'), 'b');
  assert.equal(run('num>=118'), 'bc');
  assert.equal(run('is:promo'), 'e');
  assert.equal(run('is:bannie'), 'b');
  assert.equal(run('is:deck'), 'c');
  assert.equal(run('is:champion'), 'a');
  assert.equal(run('is:foil'), 'acde');
  assert.equal(run('own:0'), 'bce');
  assert.equal(run('own>=2'), 'a');
  assert.equal(run('possédé>0'), 'ad');
});

test('operators, lists, rarity order, negation, quotes, terms add up', () => {
  assert.equal(run('e!=0'), 'abde');
  assert.equal(run('e>7'), 'e');
  assert.equal(run('e:7+'), 'de');
  assert.equal(run('e:0,1'), 'bc');
  assert.equal(run('r>=rare'), 'ace');
  assert.equal(run('r<rare'), 'bd');
  assert.equal(run('-t:sort'), 'abde');
  assert.equal(run('-d:fury'), 'bd');
  assert.equal(run('d:fury,calm'), 'acde');
  assert.equal(run('t:unité e<=3'), 'ab');
  assert.equal(run('"noxus guard"'), 'b');
  assert.equal(run('t:uni'), 'abe', 'the start of a value is enough when it is the only one');
});

test('unknown key = plain text, never an error; key without value filters nothing', () => {
  assert.equal(parseQuery('foo:bar').tokens[0].type, 'text');
  assert.equal(run('foo:bar'), '');
  assert.equal(run('t:'), 'abcde');
  assert.equal(run('e<'), 'abcde');
  assert.doesNotThrow(() => run('"unclosed'));
  assert.equal(hasKeys('jinx'), false);
  assert.equal(hasKeys('jinx t:unité'), true);
});

test('acceptance: d:esprit t:unité e<=3 own:0', () => {
  assert.equal(run('d:esprit t:unité e<=3 own:0'), 'b');
});

test('filters write the line and the line lights the filters', () => {
  // Might 4 and 5 = p>=4 p<=5, and the key is written
  let q = toggleOption('', 'p', '4', undefined, 'fr');
  q = toggleOption(q, 'p', '5', undefined, 'fr');
  assert.equal(q, 'p:4,5');
  assert.equal(run(q), run('p>=4 p<=5'));
  // typed key lights the filter
  assert.deepEqual([...selectionFor(parseQuery('e<=3'), 'e')], ['0', '1', '2', '3']);
  assert.deepEqual([...selectionFor(parseQuery('r>=rare'), 'r')], ['rare', 'epic', 'showcase']);
  assert.deepEqual([...selectionFor(parseQuery('d:esprit'), 'd')], ['mind']);
  assert.deepEqual([...selectionFor(parseQuery('e>=5'), 'e')], ['5', '6', '7+']);
  // clicking a lit option rewrites the key as a list; the rest of the line stays
  assert.equal(toggleOption('jinx e<=3', 'e', '2', undefined, 'fr'), 'jinx e:0,1,3');
  assert.equal(toggleOption('e:3', 'e', '3', undefined, 'fr'), '');
  assert.equal(toggleOption('', 't', 'unit', undefined, 'fr'), 't:unité');
  assert.equal(toggleOption('', 't', 'unit', undefined, 'en'), 't:unit');
  assert.equal(toggleOption('t:unité', 'd', 'fury', undefined, 'fr'), 't:unité d:fureur');
  assert.equal(toggleOption('-d:fury', 'd', 'mind', undefined, 'fr'), '-d:fury d:esprit', 'a negation is kept');
  assert.equal(toggleOption('', 's', 'ogn', ['ogn', 'sfd'], 'fr'), 's:ogn');
  assert.equal(setSelection('s:ogn', 's', [], 'fr'), '');
  assert.equal(toggleFlag('', 'banned', 'fr'), 'is:bannie');
  assert.equal(toggleFlag('jinx is:bannie', 'banned', 'fr'), 'jinx');
  assert.equal(removeToken('jinx t:unité e<=3', 1), 'jinx e<=3');
  assert.equal(canonValue('t', 'Champ de bataille'), 'battlefield');
});

test('chip labels', () => {
  const [a, b, c] = parseQuery('t:unité e<=3 -d:fury').tokens;
  assert.equal(tokenLabel(a), 'Type : Unité');
  assert.equal(tokenLabel(b), 'Énergie ≤ 3');
  assert.equal(tokenLabel(c), 'Pas Domaine : Fureur');
});

test('numeric slider: numTerm reads the term, setNumQuery writes it (=, >=, <=, 7+)', () => {
  assert.equal(numTerm(parseQuery(''), 'e'), null);
  assert.equal(numTerm(parseQuery('jinx'), 'e'), null);
  assert.deepEqual(numTerm(parseQuery('jinx e<=3'), 'e'), { op: '<=', values: ['3'] });
  assert.equal(setNumQuery('', 'e', ':', ['3']), 'e:3');
  assert.equal(setNumQuery('', 'e', '>=', ['7']), 'e>=7');
  assert.equal(setNumQuery('', 'e', ':', ['7+']), 'e:7+');
  assert.equal(setNumQuery('jinx e<=3 t:unité', 'e', '>=', ['4']), 'jinx t:unité e>=4', 'the other tokens stay');
  assert.equal(setNumQuery('jinx e<=3', 'e', ':', []), 'jinx', 'empty values removes the filter');
  assert.equal(setNumQuery('-e:3 e:1', 'e', ':', []), '-e:3', 'a negation is kept');
  assert.equal(run(setNumQuery('', 'e', ':', ['7+'])), run('e>=7'));
  assert.equal(run(setNumQuery('', 'p', '>=', ['5'])), run('p>=5'));
  assert.equal(run(setNumQuery('', 'e', '<=', ['1'])), run('e<=1'));
});
