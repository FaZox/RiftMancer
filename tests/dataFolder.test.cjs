// RiftMancer (21/11): the PC data folder of « Riftbound Scanner » is taken over on the first launch, the old one kept.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { takeOverOldData, MARKER } = require('../electron/dataFolder.cjs');

function appData() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-appdata-'));
  const old = path.join(d, 'riftbound-scanner');
  fs.mkdirSync(path.join(old, 'backups'), { recursive: true });
  fs.mkdirSync(path.join(old, 'GPUCache'), { recursive: true });
  fs.writeFileSync(path.join(old, 'collection.sqlite'), 'db');
  fs.writeFileSync(path.join(old, 'backups', 'b1.json'), '{}');
  fs.writeFileSync(path.join(old, 'GPUCache', 'data_0'), 'cache');
  return d;
}

test('first launch: the old folder is copied (without the caches), kept as it was, and only once', () => {
  const d = appData();
  try {
    const r = takeOverOldData(d, 'daily', 1);
    assert.equal(r.dir, path.join(d, 'riftmancer'));
    assert.equal(r.taken, true);
    assert.equal(r.files, 2);
    assert.equal(fs.readFileSync(path.join(r.dir, 'collection.sqlite'), 'utf8'), 'db');
    assert.ok(fs.existsSync(path.join(r.dir, 'backups', 'b1.json')));
    assert.ok(!fs.existsSync(path.join(r.dir, 'GPUCache')), 'caches are not copied');
    assert.ok(fs.existsSync(path.join(d, 'riftbound-scanner', 'collection.sqlite')), 'old folder untouched (backup)');
    fs.writeFileSync(path.join(r.dir, 'collection.sqlite'), 'changed in RiftMancer');
    assert.equal(takeOverOldData(d, 'daily', 2).taken, false, 'second launch: nothing copied again');
    assert.equal(fs.readFileSync(path.join(r.dir, 'collection.sqlite'), 'utf8'), 'changed in RiftMancer');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('nothing is overwritten when the new folder already holds data; no old folder: nothing to do; test app apart', () => {
  const d = appData();
  try {
    fs.mkdirSync(path.join(d, 'riftmancer'));
    fs.writeFileSync(path.join(d, 'riftmancer', 'collection.sqlite'), 'new');
    const r = takeOverOldData(d, 'daily');
    assert.equal(r.taken, false);
    assert.equal(fs.readFileSync(path.join(d, 'riftmancer', 'collection.sqlite'), 'utf8'), 'new');
    assert.equal(JSON.parse(fs.readFileSync(path.join(d, 'riftmancer', MARKER), 'utf8')).taken, false);
    const t = takeOverOldData(d, 'test');
    assert.deepEqual(t, { dir: path.join(d, 'riftmancer-test'), taken: false }, 'no riftbound-scanner-test folder');
    assert.ok(!fs.existsSync(path.join(d, 'riftmancer-test')));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
