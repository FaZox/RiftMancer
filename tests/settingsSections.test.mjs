// Lot 6 d, B.4: the same settings sections on the PC and the phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { untx } from './helpers.mjs';

const read = (p) => untx(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('nine sections in the order of B.4 (what protects the data first), one list for both apps', () => {
  const s = read('src/components/settings/sectionList.js');
  assert.match(read('src/components/settings/settingsSections.jsx'), /export \{ SECTIONS, DEV_SECTION \} from '\.\/sectionList\.js'/);
  const ids = [...s.split('export const SECTIONS')[1].split('];')[0].matchAll(/id: '(\w+)', label: '([^']+)'/g)].map(m => m[2]);
  assert.deepEqual(ids, ['Synchronisation', 'Sauvegardes', 'Contenu', 'Scanner', 'Prix', 'Affichage', 'Jeu', 'Aide', 'À propos']);
  assert.match(s, /DEV_SECTION = \{ id: 'dev', label: 'Développeur'/);
  for (const p of ['src/components/settings/SettingsTab.jsx', 'src/desktop/pages/SettingsPage.jsx']) {
    const f = read(p);
    assert.match(f, /SECTIONS, DEV_SECTION, SectionContent, useSectionStatus/, p);
    assert.match(f, /prefs\.devMode \? \[\.\.\.SECTIONS, DEV_SECTION\] : SECTIONS/, `${p}: developer section only in developer mode`);
  }
});

test('phone: list of sections, each on its own page with the back arrow', () => {
  const tab = read('src/components/settings/SettingsTab.jsx');
  assert.match(tab, /aria-label="Sections des réglages"/);
  assert.match(tab, /aria-label="Retour aux réglages"/);
  assert.match(tab, /useBackHandler\(!!open/);
});

test('Affichage: text size Normal / Grand through the platform zoom; Jeu: default format for new decks', async () => {
  const { TEXT_ZOOM } = await import('../src/lib/textSize.js');
  assert.deepEqual(TEXT_ZOOM, { normal: 1, large: 1.15 });
  assert.match(read('android/app/src/main/java/com/riftmancer/app/ScreenPlugin.java'), /setTextZoom\(percent\)/);
  assert.match(read('electron/main.cjs'), /\* textScale;/);
  const { migratePrefs } = await import('../src/lib/uiPrefs.js');
  const p = migratePrefs({ prefsVersion: 5 }).prefs;
  assert.equal(p.textSize, 'normal');
  assert.equal(p.gameFormat, 'standard');
  for (const f of ['src/components/organize/OrganizeTab.jsx', 'src/desktop/pages/DecksPage.jsx']) assert.match(read(f), /format: getPrefs\(\)\.gameFormat \|\| 'standard'/, f);
});
