// Unofficial French card texts (public/card-texts-fr.json, src/lib/cardLocale.js):
// shown when the official French text does not exist, marked as unofficial.
import { test } from 'node:test';

import assert from 'node:assert/strict';

import './helpers.mjs';

import { loadCatalog } from './helpers.mjs';

import { setCardTextsFr, unofficialTextFr, getLocalizedText } from '../src/lib/cardLocale.js';

test('unofficial FR text: by oracle (variants share it), then by id; official textFr wins', async () => {
  const m = await loadCatalog();
  const withOfficial = { id: 'x-official', oracle: 'o-official', text: '<p>Official EN</p>', textFr: 'Texte officiel' };
  const without = { id: 'x-missing', oracle: 'o-missing', text: '<p>Unofficial EN</p>' };
  m.cards.push(withOfficial, without);
  m.byId.set(withOfficial.id, withOfficial);
  m.byId.set(without.id, without);

  setCardTextsFr({ texts: { [without.oracle]: 'Texte traduit par la communauté.' } });
  assert.equal(unofficialTextFr(without), 'Texte traduit par la communauté.');
  assert.equal(unofficialTextFr({ id: without.id, oracle: without.oracle }), 'Texte traduit par la communauté.');
  assert.equal(unofficialTextFr({ id: 'unknown' }), null);
  assert.equal(setCardTextsFr(null), false, 'invalid data refused');

  const t = getLocalizedText(without, 'French');
  assert.equal(t.text, 'Texte traduit par la communauté.');
  assert.equal(t.unofficial, true);
  assert.equal(t.translated, true);

  const off = getLocalizedText(withOfficial, 'French');
  assert.equal(off.unofficial, undefined, 'official textFr is not marked unofficial');
  assert.equal(off.text, withOfficial.textFr);

  const en = getLocalizedText(without, 'English');
  assert.equal(en.isHtml, true);
  assert.equal(en.text, without.text, 'the FR/EN switch shows the English text');
});
