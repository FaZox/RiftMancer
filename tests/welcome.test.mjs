// Lot 6 g: first launch, and a new install starts empty.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import './helpers.mjs';

const { shouldWelcome } = await import('../src/lib/welcome.js');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('presentation for a new install only, never after an update with data', () => {
  assert.equal(shouldWelcome({ done: null, copies: 0, pending: 0, paired: false }), true);
  assert.equal(shouldWelcome({ done: true }), false, 'already seen');
  assert.equal(shouldWelcome({ done: null, copies: 12 }), false, 'update of an app with cards');
  assert.equal(shouldWelcome({ done: null, pending: 3 }), false);
  assert.equal(shouldWelcome({ done: null, paired: true }), false);
});

test('texts of the mockups (vouvoiement), passable and replayable', () => {
  const w = read('src/components/common/Welcome.jsx');
  for (const t of ['Scannez vos cartes', 'Rien n’est ajouté sans vous', 'Gardez vos données en sécurité', 'Appairer avec mon PC', 'Plus tard',
    'Essayer avec des données de démonstration', 'Passer', 'Bienvenue dans RiftMancer', 'Réseaux privés']) assert.ok(w.includes(t), t);
  assert.match(read('src/components/settings/settingsSections.jsx'), /requestOpen\(\{ kind: 'welcome' \}\)/);
});

test('a new install starts empty: no record, no pairing, no learned example, developer mode off', async () => {
  const { migratePrefs } = await import('../src/lib/uiPrefs.js');
  const p = migratePrefs({}).prefs;
  assert.equal(p.devMode, false);
  assert.equal(p.onboardingDone, null);
  // demo data only when the user asks (Réglages → Aide, or the last welcome screen)
  const callers = ['src/components/common/Welcome.jsx', 'src/components/settings/DemoSection.jsx'];
  const walk = (d) => readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
  const using = walk('src').filter(f => /.(js|jsx)$/.test(f) && /\bloadDemoData\b/.test(read(f)) && !f.endsWith('demoData.js'));
  assert.deepEqual(using.sort(), callers);
  // nothing personal shipped with the app (lot 2: release:check refuses databases and bench data too)
  const shipped = readdirSync(new URL('../public', import.meta.url));
  assert.ok(!shipped.some(f => /learn|collection|pairing|\.sqlite/i.test(f)), shipped.join(', '));
});
