// The public repository: no card content of Riot Games / riftboundfr.fr, no image of unknown licence, every test run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { splitFiles, personalTraces } from '../scripts/public-export.mjs';
import { excludedReason, needsCardContent } from '../scripts/lib/content.mjs';
import { TEST_FILES } from '../scripts/run-tests.mjs';

test('the public copy keeps out the card pictures and texts and the images of unknown licence, keeps the rest', () => {
  const { published, excluded } = splitFiles([
    'public/cards/ogn-001-298.webp', 'public/cards/thumbs/ogn-001-298.webp', 'public/card-hashes.json',
    'model/textures/banded_0033.jpg', 'model/distractors/a.png', 'model/manual-cards/sfd-t02.webp', 'docs/maquettes/index.html',
    'public/banlist.json', 'public/models/yolo11s-pose-riftbound-dyn.onnx', 'src/App.jsx', 'LICENSE', 'README.md', 'public/cards-note.md',
  ]);
  assert.deepEqual(published, ['public/banlist.json', 'public/models/yolo11s-pose-riftbound-dyn.onnx', 'src/App.jsx', 'LICENSE', 'README.md', 'public/cards-note.md']);
  assert.equal(excluded.length, 7);
  assert.match(excludedReason('public/card-hashes.json'), /Riot Games/);
});

test('personal traces are found: paths of a PC, personal e-mail addresses (not placeholders nor regexes)', () => {
  // built here so that this file is not itself a trace
  const drive = 'C:' + String.fromCharCode(92) + 'Users' + String.fromCharCode(92);
  const PATH_TRACE = 'chemin d’un PC (C:' + String.fromCharCode(92) + 'Users' + String.fromCharCode(92) + '…)';
  assert.deepEqual(personalTraces(`model: ${drive}jdoe${String.fromCharCode(92)}Documents${String.fromCharCode(92)}x.pt`), [PATH_TRACE]);
  assert.deepEqual(personalTraces('"C:/' + 'Users/jdoe/x"'), [PATH_TRACE]);
  assert.deepEqual(personalTraces('contact: jdoe' + '@' + 'gmail.com'), ['adresse e-mail']);
  assert.deepEqual(personalTraces(`folders (${drive}<name>), regex ${drive}[^/]+, noreply@anthropic.com`), []);
});

test('npm test runs every test file, and sets aside only those that need the card content when it is missing', () => {
  const onDisk = readdirSync(new URL('./', import.meta.url)).filter(f => /\.test\.(mjs|cjs)$/.test(f)).sort();
  assert.deepEqual([...TEST_FILES].sort(), onDisk, 'scripts/run-tests.mjs lists every test file');
  const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
  assert.equal(needsCardContent(read('./matcher.test.mjs')), true);
  assert.equal(needsCardContent(read('./i18n.test.mjs')), false);
  assert.equal(needsCardContent(read('./gridScan.test.mjs')), false);
});
