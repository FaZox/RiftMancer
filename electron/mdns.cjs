/**
 * Minimal mDNS / DNS-SD responder (no dependency): announces the PC app as
 * `_riftbound._tcp.local` so the phone finds it when its IP address changed,
 * without scanning the network.
 *
 * Only the PC fingerprint (`h=<pcIdHash>`, see syncCrypto.helloHash) is
 * published — no PC name, no user name. Instance and host names are derived
 * from the fingerprint.
 */
const dgram = require('node:dgram');
const os = require('node:os');

// Limits (RFC 6762 §11 and simple hygiene): only local senders, small packets,
// few questions, and rate limits so the PC cannot be used to flood the network.
const MAX_PACKET = 1500;
const MAX_QUESTIONS = 16;
const ANNOUNCE_EVERY = 1000;       // at most one multicast answer per second
const UNICAST_PER_SECOND = 10;     // per sender

const MDNS_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const SERVICE = '_riftbound._tcp.local';
const TYPE = { A: 1, PTR: 12, TXT: 16, SRV: 33, ANY: 255 };
const TTL = 120;

function encodeName(name) {
  const parts = name.split('.').filter(Boolean);
  const bufs = parts.map(p => {
    const b = Buffer.from(p, 'utf8');
    return Buffer.concat([Buffer.from([b.length]), b]);
  });
  return Buffer.concat([...bufs, Buffer.from([0])]);
}

function record(name, type, rdata, { flush = false, ttl = TTL } = {}) {
  const head = Buffer.alloc(10);
  head.writeUInt16BE(type, 0);
  head.writeUInt16BE(flush ? 0x8001 : 0x0001, 2);
  head.writeUInt32BE(ttl, 4);
  head.writeUInt16BE(rdata.length, 8);
  return Buffer.concat([encodeName(name), head, rdata]);
}

/** Full answer: PTR + SRV + TXT + A records. */
function buildResponse({ instance, host, port, txt, addresses, ttl = TTL }) {
  const srv = Buffer.alloc(6);
  srv.writeUInt16BE(0, 0);
  srv.writeUInt16BE(0, 2);
  srv.writeUInt16BE(port, 4);
  const txtData = Buffer.concat(Object.entries(txt).map(([k, v]) => {
    const b = Buffer.from(`${k}=${v}`, 'utf8');
    return Buffer.concat([Buffer.from([b.length]), b]);
  }));
  const answers = [
    record(SERVICE, TYPE.PTR, encodeName(instance), { ttl }),
    record(instance, TYPE.SRV, Buffer.concat([srv, encodeName(host)]), { flush: true, ttl }),
    record(instance, TYPE.TXT, txtData, { flush: true, ttl }),
    ...addresses.map(ip => record(host, TYPE.A, Buffer.from(ip.split('.').map(Number)), { flush: true, ttl })),
  ];
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(0x8400, 2); // response, authoritative
  header.writeUInt16BE(0, 4);
  header.writeUInt16BE(answers.length, 6);
  return Buffer.concat([header, ...answers]);
}

/** Reads a (possibly compressed) name at `offset`. */
function readName(buf, offset) {
  const labels = [];
  let jumped = false;
  let end = offset;
  for (let guard = 0; guard < 128; guard++) {
    const len = buf[offset];
    if (len === undefined) throw new Error('bad name');
    if (len === 0) { if (!jumped) end = offset + 1; break; }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) end = offset + 2;
      offset = ((len & 0x3f) << 8) | buf[offset + 1];
      jumped = true;
      continue;
    }
    labels.push(buf.toString('utf8', offset + 1, offset + 1 + len));
    offset += 1 + len;
  }
  return { name: labels.join('.').toLowerCase(), end };
}

/** Questions of a DNS query packet: [{ name, type, unicast }]. Throws on garbage. */
function parseQuestions(buf) {
  if (buf.length < 12) throw new Error('short');
  if (buf.length > MAX_PACKET) throw new Error('too big');
  const flags = buf.readUInt16BE(2);
  if (flags & 0x8000) return []; // a response, not a query
  const qd = buf.readUInt16BE(4);
  if (qd > MAX_QUESTIONS) throw new Error('too many questions');
  const out = [];
  let off = 12;
  for (let i = 0; i < qd; i++) {
    const { name, end } = readName(buf, off);
    const type = buf.readUInt16BE(end);
    const cls = buf.readUInt16BE(end + 2);
    out.push({ name, type, unicast: !!(cls & 0x8000) });
    off = end + 4;
  }
  return out;
}

/** IPv4 networks of this PC: [{ addr, mask }] as 32-bit numbers. */
function localNetworks(ifaces = os.networkInterfaces()) {
  const out = [];
  for (const list of Object.values(ifaces)) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      out.push({ addr: ipNum(a.address), mask: ipNum(a.netmask) });
    }
  }
  return out;
}

function ipNum(ip) {
  const p = String(ip).split('.').map(Number);
  if (p.length !== 4 || p.some(x => !(x >= 0 && x <= 255))) return null;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

/** Is `address` on one of the PC's own networks (link-local)? */
function isLocalSource(address, nets = localNetworks()) {
  const a = ipNum(String(address).replace(/^::ffff:/, ''));
  if (a == null) return false;
  return nets.some(n => n.addr != null && n.mask != null && ((a & n.mask) >>> 0) === ((n.addr & n.mask) >>> 0));
}

/**
 * Starts answering. `getInfo()` → { hash, port, addresses } is called for each
 * answer (the fingerprint changes with « Régénérer la clé »).
 * @returns {{ stop(): void }}
 */
function startMdns(getInfo, log = () => {}) {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  let closed = false;

  function describe() {
    const { hash, port, addresses } = getInfo();
    const id = String(hash).slice(0, 12);
    return { instance: `riftbound-${id}.${SERVICE}`, host: `riftbound-${id}.local`, port, txt: { h: hash, v: 3 }, addresses };
  }

  function sendTo(packet, port, address) {
    sock.send(packet, port, address, err => { if (err) log('[mdns] send', err.message); });
  }

  function announce(ttl = TTL) {
    if (closed) return;
    const d = describe();
    const packet = buildResponse({ ...d, ttl });
    for (const ip of d.addresses) {
      try { sock.setMulticastInterface(ip); } catch { /* interface gone */ }
      sendTo(packet, MDNS_PORT, MDNS_ADDR);
    }
  }

  let lastAnnounce = 0;
  const unicastCount = new Map(); // sender → { n, since }
  let nets = localNetworks();
  const netsTimer = setInterval(() => { nets = localNetworks(); }, 60 * 1000);

  sock.on('message', (msg, rinfo) => {
    // Only machines of the local network get an answer (RFC 6762 §11).
    if (!isLocalSource(rinfo.address, nets)) return;
    let questions;
    try { questions = parseQuestions(msg); } catch { return; }
    if (!questions.length) return;
    const d = describe();
    const ours = new Set([SERVICE, d.instance.toLowerCase(), d.host.toLowerCase(), '_services._dns-sd._udp.local']);
    const hit = questions.find(q => ours.has(q.name) && [TYPE.PTR, TYPE.SRV, TYPE.TXT, TYPE.A, TYPE.ANY].includes(q.type));
    if (!hit) return;
    const packet = buildResponse(d);
    const now = Date.now();
    // Legacy / one-shot queries (source port ≠ 5353) or QU bit: answer the asker directly.
    if (rinfo.port !== MDNS_PORT || hit.unicast) {
      const c = unicastCount.get(rinfo.address);
      if (!c || now - c.since >= 1000) unicastCount.set(rinfo.address, { n: 1, since: now });
      else if (++c.n > UNICAST_PER_SECOND) return;
      if (unicastCount.size > 256) for (const [k, v] of unicastCount) if (now - v.since >= 1000) unicastCount.delete(k);
      sendTo(packet, rinfo.port, rinfo.address);
    }
    if (rinfo.port === MDNS_PORT && now - lastAnnounce >= ANNOUNCE_EVERY) {
      lastAnnounce = now;
      announce();
    }
  });
  sock.on('error', err => log('[mdns]', err.message));
  sock.bind(MDNS_PORT, () => {
    try { sock.setMulticastTTL(255); } catch { /* ignore */ }
    for (const ip of getInfo().addresses) {
      try { sock.addMembership(MDNS_ADDR, ip); } catch (err) { log('[mdns] membership', ip, err.message); }
    }
    announce();
    setTimeout(announce, 1000);
  });

  return {
    announce,
    stop() {
      if (closed) return;
      try { announce(0); } catch { /* goodbye best effort */ }
      closed = true;
      clearInterval(netsTimer);
      setTimeout(() => { try { sock.close(); } catch { /* already closed */ } }, 50);
    },
  };
}

module.exports = { startMdns, buildResponse, parseQuestions, encodeName, isLocalSource, localNetworks, SERVICE };
