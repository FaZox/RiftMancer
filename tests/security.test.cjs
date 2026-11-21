// Lot 1: backup listing/restore validation and static-server path checks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { listBackups, resolveBackup } = require('../electron/backups.cjs');
const { createServer } = require('../electron/server.cjs');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('listBackups returns backups, most recent first', () => {
  const dir = tmpDir('rb-backups-');
  const a = path.join(dir, 'collection-2026-01-01.sqlite');
  const b = path.join(dir, 'collection-2026-02-01.sqlite');
  fs.writeFileSync(a, 'a');
  fs.writeFileSync(b, 'bb');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
  fs.utimesSync(a, new Date('2026-01-01'), new Date('2026-01-01'));
  fs.utimesSync(b, new Date('2026-02-01'), new Date('2026-02-01'));
  const list = listBackups(dir);
  assert.deepEqual(list.map(x => x.name), ['collection-2026-02-01.sqlite', 'collection-2026-01-01.sqlite']);
  assert.equal(list[0].size, 2);
  assert.deepEqual(listBackups(path.join(dir, 'missing')), []);
});

test('resolveBackup refuses invalid or missing names', () => {
  const dir = tmpDir('rb-backups-');
  fs.writeFileSync(path.join(dir, 'collection-1.sqlite'), 'a');
  assert.equal(resolveBackup(dir, 'collection-1.sqlite'), path.resolve(dir, 'collection-1.sqlite'));
  for (const bad of ['../x.sqlite', '..\\x.sqlite', 'collection-../../x.sqlite', 'collection-2.sqlite', 'x.sqlite', '', null, 42]) {
    assert.equal(resolveBackup(dir, bad), null, String(bad));
  }
});

function get(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET' }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('static server refuses paths escaping dist/ (sibling folders included)', async () => {
  const base = tmpDir('rb-static-');
  const dist = path.join(base, 'dist');
  fs.mkdirSync(dist);
  fs.mkdirSync(path.join(base, 'dist-mobile'));
  fs.writeFileSync(path.join(dist, 'index.html'), 'APP');
  fs.writeFileSync(path.join(dist, 'a.js'), 'JS');
  fs.writeFileSync(path.join(base, 'dist-mobile', 'index.html'), 'SECRET');
  const { server } = createServer({ store: null, distDir: dist, getName: () => 'pc', onSynced: () => {}, getPrices: () => null });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    assert.equal((await get(port, '/a.js')).body, 'JS');
    assert.equal((await get(port, '/')).body, 'APP');
    // « / » escapes: always 403.
    for (const p of ['/..%2Fdist-mobile%2Findex.html', '/%2E%2E%2Fdist-mobile%2Findex.html', '/..%2F..%2Fetc%2Fpasswd']) {
      const r = await get(port, p);
      assert.equal(r.status, 403, p);
      assert.notEqual(r.body, 'SECRET');
    }
    // « \ » escapes: a separator on Windows (403); elsewhere a normal file-name
    // character, so the server looks for a file of that name in dist/ (404).
    // Never the content of the neighbouring folder.
    for (const p of ['/..%5Cdist-mobile%5Cindex.html', '/..%5C..%5Cdist-mobile%5Cindex.html']) {
      const r = await get(port, p);
      if (process.platform === 'win32') assert.equal(r.status, 403, p);
      else assert.ok([403, 404].includes(r.status), `${p} → ${r.status}`);
      assert.notEqual(r.body, 'SECRET');
    }
  } finally {
    server.close();
  }
});
