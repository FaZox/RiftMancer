// Lot 4.6: PC ↔ phone versions, « Nouveautés » after an update, lighter APK.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers.mjs';

const V = await import('../src/lib/versionCompat.js');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('protocol different: the side with the lower protocol is told to update', () => {
  assert.deepEqual(V.phoneCompat({ myProto: 4, pcProto: 3, myVersion: '2.2.0' }),
    { tone: 'bad', update: 'pc', text: 'L’appli du PC est plus ancienne. Mettez-la à jour pour synchroniser.' });
  assert.equal(V.phoneCompat({ myProto: 4, pcProto: 3, pcVersion: '2.1.0' }).text, 'L’appli du PC est plus ancienne (2.1.0). Mettez-la à jour pour synchroniser.');
  assert.equal(V.phoneCompat({ myProto: 3, pcProto: 4 }).update, 'phone');
});

test('app versions different (seen at the last sync): a warning naming what to update', () => {
  assert.equal(V.phoneCompat({ myProto: 3, pcProto: null, myVersion: '2.1.0', pcVersion: '2.1.0' }), null);
  assert.equal(V.phoneCompat({ myVersion: '2.1.0-test', pcVersion: '2.1.0' }), null, 'test build suffix ignored');
  assert.deepEqual(V.phoneCompat({ myVersion: '2.2.0', pcVersion: '2.1.0' }),
    { tone: 'warn', update: 'pc', text: 'L’appli du PC est plus ancienne (2.1.0). Mettez-la à jour : les deux appareils doivent avoir la même version.' });
  assert.equal(V.phoneCompat({ myVersion: '2.1.0', pcVersion: '2.10.0' }).update, 'phone', '2.10 is newer than 2.1');
  assert.equal(V.pcCompat({ myVersion: '2.2.0', phoneVersion: '2.1.0', phoneName: 'Pixel 7' }).text, 'L’appli de « Pixel 7 » est plus ancienne (2.1.0). Mettez-la à jour.');
  assert.equal(V.pcCompat({ myVersion: '2.2.0', phoneVersion: null }), null, 'never synced since: nothing said');
});

test('« Nouveautés » from docs/NOUVEAUTES.md, shown only after an update', () => {
  const md = '# N\n\n## 2.2.0 — 1er déc.\n\n- **Scanner plus fiable** : les cartes tournées.\n- Ligne simple\n\n## 2.1.0\n\n- **Avant** : x\n';
  assert.deepEqual(V.whatsNew(md, '2.2.0'), { version: '2.2.0', title: '2.2.0 — 1er déc.', items: [{ title: 'Scanner plus fiable', text: 'les cartes tournées.' }, { title: null, text: 'Ligne simple' }] });
  assert.equal(V.whatsNew(md, '2.2.0-test').version, '2.2.0');
  assert.equal(V.whatsNew(md, '3.0.0'), null);
  assert.equal(V.shouldShowWhatsNew(null, '2.1.0'), false, 'first install: no « Nouveautés »');
  assert.equal(V.shouldShowWhatsNew('2.1.0', '2.1.0'), false);
  assert.equal(V.shouldShowWhatsNew('2.1.0', '2.2.0'), true);
  assert.equal(V.shouldShowWhatsNew('2.2.0', '2.1.0'), false, 'going back: nothing');
  const pkg = JSON.parse(read('package.json'));
  const notes = V.whatsNew(read('docs/NOUVEAUTES.md'), pkg.version);
  assert.ok(notes && notes.items.every(i => i.title), 'the notes of this version have a title per line (tel-13)');
});

test('lighter APK: no full-size images, the phone downloads them all from the PC', () => {
  assert.match(read('scripts/build-mobile.mjs'), /grandes images retirées de l'APK/);
  const assets = read('src/lib/nativeAssets.js');
  assert.match(assets, /if \(full && !haveFull\.has\(name\)\)/, 'full images downloaded even for the cards of the catalog shipped with the app');
  assert.match(assets, /if \(isNative\) return downloadedImageSrc\(cardId\)/);
  assert.match(read('src/components/collection/CardZoom.jsx'), /Image en haute définition après la première synchro/);
});
