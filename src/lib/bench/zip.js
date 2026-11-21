/**
 * Minimal ZIP files without compression (method 0, « stored »), for the
 * bench export (MODULE-BANC.md 4.3). The photos are JPEGs: compressing them
 * again gains nothing, and storing them keeps each photo byte for byte.
 *
 * Works in the browser and in Node (Uint8Array only). Limits: no ZIP64
 * (each file and the whole archive under 4 GB, under 65 535 files).
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 of `bytes` (the one of ZIP / PNG). */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
const MAX = 0xffffffff;

function dosDateTime(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const day = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, day };
}

/**
 * Writes a ZIP, piece by piece (to write a big archive in chunks):
 *   const z = new ZipWriter();
 *   out.push(...z.add('a/b.jpg', bytes, date));  … ;  out.push(z.finish());
 * Each call returns the bytes to append to the file.
 */
export class ZipWriter {
  constructor() {
    this.offset = 0;
    this.central = [];
    this.names = new Set();
  }

  /** @returns {Uint8Array[]} local header + data of the file */
  add(name, data, date = new Date()) {
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) throw new Error(`Nom de fichier invalide dans le ZIP : ${name}`);
    if (this.names.has(name)) throw new Error(`Fichier en double dans le ZIP : ${name}`);
    this.names.add(name);
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    if (bytes.length >= MAX || this.offset + bytes.length >= MAX) throw new Error('Collecte trop grosse pour un seul ZIP (4 Go) : exportez en plusieurs fois.');
    if (this.central.length >= 0xffff) throw new Error('Trop de fichiers pour un seul ZIP.');
    const nameBytes = enc.encode(name);
    const crc = crc32(bytes);
    const { time, day } = dosDateTime(date);
    const head = new Uint8Array(30 + nameBytes.length);
    const v = new DataView(head.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);           // version needed
    v.setUint16(6, 0x0800, true);       // UTF-8 names
    v.setUint16(8, 0, true);            // stored
    v.setUint16(10, time, true);
    v.setUint16(12, day, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, bytes.length, true);
    v.setUint32(22, bytes.length, true);
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0, true);
    head.set(nameBytes, 30);
    this.central.push({ nameBytes, crc, size: bytes.length, time, day, offset: this.offset });
    this.offset += head.length + bytes.length;
    return [head, bytes];
  }

  /** @returns {Uint8Array} central directory + end record */
  finish() {
    const size = this.central.reduce((n, e) => n + 46 + e.nameBytes.length, 0);
    const out = new Uint8Array(size + 22);
    const v = new DataView(out.buffer);
    let p = 0;
    for (const e of this.central) {
      v.setUint32(p, 0x02014b50, true);
      v.setUint16(p + 4, 20, true);     // made by
      v.setUint16(p + 6, 20, true);     // needed
      v.setUint16(p + 8, 0x0800, true);
      v.setUint16(p + 10, 0, true);
      v.setUint16(p + 12, e.time, true);
      v.setUint16(p + 14, e.day, true);
      v.setUint32(p + 16, e.crc, true);
      v.setUint32(p + 20, e.size, true);
      v.setUint32(p + 24, e.size, true);
      v.setUint16(p + 28, e.nameBytes.length, true);
      // extra, comment, disk, internal attributes: 0
      v.setUint32(p + 38, 0, true);     // external attributes
      v.setUint32(p + 42, e.offset, true);
      out.set(e.nameBytes, p + 46);
      p += 46 + e.nameBytes.length;
    }
    v.setUint32(p, 0x06054b50, true);
    v.setUint16(p + 8, this.central.length, true);
    v.setUint16(p + 10, this.central.length, true);
    v.setUint32(p + 12, size, true);
    v.setUint32(p + 16, this.offset, true);
    return out;
  }
}

/** Joins byte arrays. */
export function concatBytes(parts) {
  const out = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
  let p = 0;
  for (const a of parts) { out.set(a, p); p += a.length; }
  return out;
}

/** Whole ZIP in memory: [{ name, data, date? }] → Uint8Array. */
export function zipStore(files) {
  const z = new ZipWriter();
  const parts = [];
  for (const f of files) parts.push(...z.add(f.name, f.data, f.date));
  parts.push(z.finish());
  return concatBytes(parts);
}

/**
 * Reads a ZIP of stored files (the ones written above). Compressed entries
 * are refused (this reader is only for the app's own exports).
 * @returns {{ name: string, data: Uint8Array }[]}
 */
export function readZipStore(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('Ce fichier n’est pas un ZIP.');
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const dec = new TextDecoder();
  const out = [];
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP abîmé (répertoire central).');
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue; // folder entry
    if (method !== 0) throw new Error(`ZIP compressé (${name}) : utilisez le ZIP exporté par l’appli, sans le recompresser.`);
    if (v.getUint32(local, true) !== 0x04034b50) throw new Error(`ZIP abîmé (${name}).`);
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (crc32(data) !== crc) throw new Error(`ZIP abîmé : ${name} ne correspond pas à son CRC.`);
    out.push({ name, data });
  }
  return out;
}
