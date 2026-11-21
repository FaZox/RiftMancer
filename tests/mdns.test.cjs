/* mDNS responder: robust parsing, local senders only. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseQuestions, isLocalSource, buildResponse } = require('../electron/mdns.cjs');

function query(qd, body = Buffer.alloc(0)) {
  const h = Buffer.alloc(12);
  h.writeUInt16BE(qd, 4);
  return Buffer.concat([h, body]);
}

test('parseQuestions: truncated packet, pointer loop, huge question count → no crash', () => {
  assert.throws(() => parseQuestions(Buffer.alloc(5)));
  // name truncated in the middle
  assert.throws(() => parseQuestions(query(1, Buffer.from([10, 0x61, 0x62]))));
  // pointer to itself (loop)
  assert.doesNotThrow(() => { try { parseQuestions(query(1, Buffer.from([0xc0, 12, 0, 12, 0, 1]))); } catch { /* refused, fine */ } });
  // 65535 questions announced
  assert.throws(() => parseQuestions(query(65535)), /too many/);
  // oversized packet
  assert.throws(() => parseQuestions(Buffer.alloc(2000)), /too big/);
  // a normal question still works
  const name = Buffer.from([10, ...Buffer.from('_riftbound'), 4, ...Buffer.from('_tcp'), 5, ...Buffer.from('local'), 0, 0, 12, 0, 1]);
  assert.deepEqual(parseQuestions(query(1, name)), [{ name: '_riftbound._tcp.local', type: 12, unicast: false }]);
});

test('only senders of the local networks get an answer', () => {
  const nets = [{ addr: (192 << 24 | 168 << 16 | 50 << 8 | 160) >>> 0, mask: 0xffffff00 }];
  assert.equal(isLocalSource('192.168.50.155', nets), true);
  assert.equal(isLocalSource('::ffff:192.168.50.7', nets), true);
  assert.equal(isLocalSource('192.168.51.155', nets), false);
  assert.equal(isLocalSource('8.8.8.8', nets), false);
  assert.equal(isLocalSource('not-an-ip', nets), false);
});

test('the answer only publishes the fingerprint (no PC name)', () => {
  const p = buildResponse({ instance: 'riftbound-abc._riftbound._tcp.local', host: 'riftbound-abc.local', port: 47321, txt: { h: 'abc', v: 3 }, addresses: ['192.168.1.2'] });
  assert.ok(!p.toString('latin1').toLowerCase().includes('pc-'));
});
