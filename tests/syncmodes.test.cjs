/* Sync directions over the real PC server: both / push (phone → PC) / pull (PC → phone), and the « send to the phone » offer. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startPc, pairPhone } = require('./syncHelpers.cjs');

async function start() {
  const pc = await startPc();
  const phone = await pairPhone(pc, 'Test');
  const sync = (body) => phone.request('/api/sync', { method: 'POST', body });
  const status = () => phone.request('/api/status');
  return { store: pc.store, server: pc.server, base: pc.base, sync, status };
}
const rec = (id, updatedAt) => ({ id, cardId: 'ogn-001-298', updatedAt, deleted: false });

test('push: the PC stores the phone changes and sends nothing back', async () => {
  const { store, server, sync } = await start();
  store.putLocal('copies', [rec('pc1', 100)]);
  const res = await sync({ since: 0, mode: 'push', push: { copies: [rec('ph1', 200)] } });
  assert.equal(res.mode, 'push');
  assert.deepEqual(res.pull.copies, []);
  assert.equal(res.seq, 0); // the phone keeps its position: it will still receive pc1 later
  assert.deepEqual(store.load('copies').map(r => r.id).sort(), ['pc1', 'ph1']);
  server.close();
});

test('pull: the phone receives the PC data, what it sends is ignored', async () => {
  const { store, server, sync } = await start();
  store.putLocal('copies', [rec('pc1', 100)]);
  const res = await sync({ since: 0, mode: 'pull', push: { copies: [rec('ph1', 200)] } });
  assert.deepEqual(res.pull.copies.map(r => r.id), ['pc1']);
  assert.deepEqual(store.load('copies').map(r => r.id), ['pc1']);
  server.close();
});

test('both ways (default)', async () => {
  const { store, server, sync } = await start();
  store.putLocal('copies', [rec('pc1', 100)]);
  const res = await sync({ since: 0, push: { copies: [rec('ph1', 200)] } });
  assert.deepEqual(res.pull.copies.map(r => r.id), ['pc1']);
  assert.equal(store.count('copies'), 2);
  server.close();
});

test('« send to the phone »: the offer shows in status and ends when the phone receives', async () => {
  const { store, server, sync, status } = await start();
  store.setMeta('phoneOffer', 1234);
  let hello = await status();
  assert.equal(hello.offer, 1234);
  await sync({ since: 0, mode: 'push', push: {} });
  hello = await status();
  assert.equal(hello.offer, 1234); // sending to the PC does not answer the offer
  await sync({ since: 0, mode: 'pull' });
  hello = await status();
  assert.equal(hello.offer, null);
  server.close();
});
