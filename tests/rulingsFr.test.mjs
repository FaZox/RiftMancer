// French rendering of the rulings (src/lib/rulingsFr.js): card names in their
// official French form + mechanics glossary verified against the official
// French card texts. Deterministic, offline.
import { test } from 'node:test';

import assert from 'node:assert/strict';

import './helpers.mjs';

import { MECHANICS_FR, buildGlossary, translateRulingText, translateRulingHtml, rulingsEntryFr, setRulingsFr, curatedRuling, missingCuratedRulings } from '../src/lib/rulingsFr.js';

const catalog = [
  { id: 'ogs-014-024', name: 'Lux', nameEn: 'Lux - Crownguard', type: 'unit', oracle: 'lux', nameFr: 'Lux - Gardienne' },
  { id: 'ogn-299-298', name: 'Daughter of the Void', nameEn: "Kai'Sa - Daughter of the Void", type: 'legend', tags: ['Kai\'Sa'], nameFr: "Kai'Sa - Fille du Néant" },
  { id: 'sfd-136-001', name: 'Hard Bargain', nameEn: 'Hard Bargain', type: 'spell', nameFr: 'Bon marché' },
  { id: 'unl-010-219', name: 'Akali', type: 'unit', oracle: 'akali' }, // no French name: not in the glossary
];

test('the glossary maps every English spelling of a card to its official French name', () => {
  const g = buildGlossary(catalog);
  assert.equal(translateRulingText('Can I use Lux, Crownguard to pay for Hard Bargain?', g),
    'Can I use Lux - Gardienne to pay for Bon marché?', 'verbs stay English: no franglais');
  assert.equal(translateRulingText('Kai\'Sa - Daughter of the Void and Kai\'Sa Daughter of the Void', g),
    "Kai'Sa - Fille du Néant and Kai'Sa - Fille du Néant", 'the « tag name » spelling of a legend too');
  assert.equal(translateRulingText('Akali stays English', g), 'Akali stays English', 'no nameFr: untouched');
});

test('mechanics vocabulary: longest match first, plurals, phrases, case preserved, word boundaries', () => {
  const g = buildGlossary(catalog);
  assert.equal(translateRulingText('units', g), 'unités', '« units » not « unité » + « s »');
  assert.equal(translateRulingText('Unit', g), 'Unité', 'initial capital kept');
  assert.equal(translateRulingText('unitary', g), 'unitary', 'no match inside a word');
  assert.equal(translateRulingText('this turn', g), 'pendant ce tour');
  assert.equal(translateRulingText('an enemy unit on the battlefield', g), 'an unité ennemie on the champ de bataille', 'articles stay English: only glossary terms are translated');
  assert.equal(translateRulingText('deal damage to a unit', g), 'deal dégâts to a unité', 'only the nouns are translated');
  assert.ok(MECHANICS_FR.some(([en]) => en === 'battlefield'), 'the glossary carries the core terms');
});

test('HTML: only the text between the tags is translated, tags and attributes untouched', () => {
  const g = buildGlossary(catalog);
  const html = '<p>Hard Bargain <a href="https://www.riftboundfaq.com/cards/hard-bargain" title="Hard Bargain">targets</a> a unit.<sup><a href="https://www.riftboundfaq.com/x#R1">1</a></sup></p>';
  assert.equal(translateRulingHtml(html, g),
    '<p>Bon marché <a href="https://www.riftboundfaq.com/cards/hard-bargain" title="Hard Bargain">targets</a> a unité.<sup><a href="https://www.riftboundfaq.com/x#R1">1</a></sup></p>');
  assert.equal(translateRulingHtml('<script>alert(1)</script>', g), '<script>alert(1)</script>', 'tag parts are never rewritten');
  assert.equal(translateRulingHtml(null, g), '');
});

test('rulingsEntryFr: same shape with questionFr / htmlFr, memoized per entry', () => {
  const entry = {
    name: 'Hard Bargain', url: 'https://www.riftboundfaq.com/cards/hard-bargain', authors: ['Near'], ids: ['sfd-136-001'],
    rulings: [{ id: 'q1', question: 'Does Hard Bargain draw a card?', html: '<p>Yes, you draw a card.</p>' }],
  };
  const fr = rulingsEntryFr(entry, catalog);
  assert.equal(fr.name, 'Hard Bargain');
  assert.deepEqual(fr.ids, ['sfd-136-001']);
  assert.equal(fr.rulings[0].questionFr, 'Does Bon marché draw a card?');
  assert.equal(fr.rulings[0].htmlFr, '<p>Yes, you draw a card.</p>');
  assert.equal(fr.rulings[0].question, entry.rulings[0].question, 'the English original is kept');
  assert.equal(rulingsEntryFr(entry, catalog), fr, 'same object for the same entry');
  assert.equal(rulingsEntryFr(null, catalog), null);
  assert.equal(buildGlossary(catalog), buildGlossary(catalog), 'glossary memoized per catalog');
});

test('curated layer (rulings-fr.json): preferred over the glossary, marked, cache follows the version', () => {
  const entry = {
    name: 'Hard Bargain',
    rulings: [
      { id: 'q1', question: 'Does Hard Bargain draw a card?', html: '<p>Yes.</p>' },
      { id: 'q2', question: 'Another question?', html: '<p>No.</p>' },
    ],
  };
  assert.equal(setRulingsFr({ cards: { 'Hard Bargain': { q1: { q: 'Question traduite ?', a: '<p>Oui.</p>' } } } }), true);
  assert.deepEqual(curatedRuling('Hard Bargain', 'q1'), { q: 'Question traduite ?', a: '<p>Oui.</p>' });
  assert.equal(curatedRuling('Hard Bargain', 'q2'), null);
  assert.equal(setRulingsFr(null), false, 'invalid data refused');
  const fr = rulingsEntryFr(entry, catalog);
  assert.equal(fr.rulings[0].questionFr, 'Question traduite ?', 'curated translation wins');
  assert.equal(fr.rulings[0].curated, true);
  assert.equal(fr.rulings[1].questionFr, 'Another question?', 'no curated: glossary fallback');
  assert.equal(fr.rulings[1].curated, false);
  setRulingsFr({ cards: {} });
  assert.equal(rulingsEntryFr(entry, catalog).rulings[0].questionFr, 'Does Bon marché draw a card?', 'cache invalidated when the layer changes');
  setRulingsFr({ cards: {} });
});

test('missingCuratedRulings: the FAQ rulings without a curated translation', () => {
  const faq = { cards: [
    { name: 'A', rulings: [{ id: 'a1', question: 'Q1' }, { id: 'a2', question: 'Q2' }] },
    { name: 'B', rulings: [{ id: 'b1', question: 'Q3' }] },
  ] };
  const fr = { cards: { A: { a1: { q: 'q', a: 'a' } } } };
  assert.deepEqual(missingCuratedRulings(faq, fr), [
    { card: 'A', id: 'a2', question: 'Q2' },
    { card: 'B', id: 'b1', question: 'Q3' },
  ]);
  assert.deepEqual(missingCuratedRulings(faq, { cards: { A: { a1: {}, a2: {} }, B: { b1: {} } } }), []);
  assert.deepEqual(missingCuratedRulings(null, fr), []);
});
