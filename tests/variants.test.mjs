// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
// Lot 8.4: the variants the scan tells apart, said in words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { variantOf, printingLabel, VARIANT_LABEL } from '../src/lib/variants.js';

test('alternate art, signed, normal — from the card id', () => {
  assert.equal(variantOf('ogn-066a-298'), 'alt');
  assert.equal(variantOf('unl-150a-219'), 'alt');
  assert.equal(variantOf('ogn-299-star-298'), 'signed');
  assert.equal(variantOf('ogn-066-298'), null);
  assert.equal(variantOf('unl-r02'), null);
  assert.equal(variantOf('rad-sp1-005'), null);
  assert.equal(VARIANT_LABEL.signed, 'Signée');
});

test('the « same illustration » buttons tell the signed card from the normal one', () => {
  assert.equal(printingLabel({ id: 'ogn-299-298', set: 'OGN' }), 'OGN');
  assert.equal(printingLabel({ id: 'ogn-299-star-298', set: 'OGN' }), 'OGN signée');
});

test('the catalog: every signed card is grouped with its normal card, alternate arts stand alone', () => {
  const cards = JSON.parse(readFileSync(new URL('../public/card-hashes.json', import.meta.url), 'utf8')).cards;
  const signed = cards.filter(c => variantOf(c.id) === 'signed');
  assert.ok(signed.length > 0);
  for (const c of signed) {
    const normal = cards.find(n => n.id === c.id.replace('-star-', '-'));
    assert.ok(normal, c.id);
    assert.equal(c.artGroup, normal.artGroup, `${c.id} grouped with ${normal.id}`);
  }
  const alts = cards.filter(c => variantOf(c.id) === 'alt');
  assert.ok(alts.length > 0);
  assert.equal(alts.filter(c => c.artGroup && cards.some(o => o.id !== c.id && o.artGroup === c.artGroup && o.id === c.id.replace(/(\d+)[a-z]-/, '$1-'))).length, 0);
});
