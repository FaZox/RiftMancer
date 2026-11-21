/**
 * Removes the personal data of a JPEG without touching its picture
 * (MODULE-BANC.md 3): the EXIF block (GPS position, phone model, dates…),
 * XMP, IPTC, comments and the extra pictures some phones append after the
 * photo (depth map, « multi-picture »). Only the orientation is kept, in a
 * new minimal EXIF block, so the photo still shows the right way up.
 * The compressed picture data is copied byte for byte (no re-encoding).
 *
 * Works in the browser and in Node (Uint8Array only).
 */

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP14 = 0xee;
const COM = 0xfe;

const startsWith = (bytes, at, text) => {
  for (let i = 0; i < text.length; i++) if (bytes[at + i] !== text.charCodeAt(i)) return false;
  return true;
};

export function isJpeg(bytes) {
  return bytes?.length > 3 && bytes[0] === 0xff && bytes[1] === SOI && bytes[2] === 0xff;
}

/**
 * Tags of a TIFF block (EXIF without its « Exif\0\0 » prefix): IFD0 tags and
 * whether there is a GPS block. @returns {{ tags: number[], gps: boolean, orientation: number|null }}
 */
function readTiff(t) {
  const out = { tags: [], gps: false, orientation: null };
  if (t.length < 8) return out;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return out;
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const ifd = v.getUint32(4, le);
  if (ifd + 2 > t.length) return out;
  const n = v.getUint16(ifd, le);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) break;
    const tag = v.getUint16(e, le);
    out.tags.push(tag);
    if (tag === 0x8825) out.gps = true;
    if (tag === 0x0112) out.orientation = v.getUint16(e + 8, le);
  }
  return out;
}

/** Segments of a JPEG before the picture data: [{ marker, start, end }] (end exclusive). */
function* segments(bytes) {
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff) throw new Error('JPEG abîmé (segment attendu).');
    while (bytes[p + 1] === 0xff) p++; // fill bytes
    const marker = bytes[p + 1];
    if (marker === EOI) return;
    const len = (bytes[p + 2] << 8) | bytes[p + 3];
    yield { marker, start: p, end: p + 2 + len };
    if (marker === SOS) return;
    p += 2 + len;
  }
}

/**
 * What the EXIF of a JPEG contains (tests, « Ma collecte »).
 * @returns {{ exif: boolean, gps: boolean, tags: number[], orientation: number|null }}
 */
export function jpegExifInfo(bytes) {
  const out = { exif: false, gps: false, tags: [], orientation: null };
  if (!isJpeg(bytes)) return out;
  for (const s of segments(bytes)) {
    if (s.marker === APP1 && startsWith(bytes, s.start + 4, 'Exif\0\0')) {
      const r = readTiff(bytes.subarray(s.start + 10, s.end));
      out.exif = true;
      out.gps = out.gps || r.gps;
      out.tags.push(...r.tags);
      if (r.orientation != null) out.orientation = r.orientation;
    }
  }
  return out;
}

/** Minimal EXIF segment holding only the orientation (1–8). */
function orientationSegment(o) {
  const seg = new Uint8Array(2 + 2 + 6 + 8 + 2 + 12 + 4);
  const v = new DataView(seg.buffer);
  v.setUint16(0, 0xff00 | APP1);
  v.setUint16(2, seg.length - 2);
  seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); // "Exif\0\0"
  const t = 10;
  seg.set([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8], t); // big endian TIFF, IFD0 at 8
  v.setUint16(t + 8, 1);          // one entry
  v.setUint16(t + 10, 0x0112);    // Orientation
  v.setUint16(t + 12, 3);         // SHORT
  v.setUint32(t + 14, 1);         // count
  v.setUint16(t + 18, o);         // value (left-justified)
  v.setUint32(t + 22, 0);         // no next IFD
  return seg;
}

/** Segments kept before the picture: everything but metadata (APPn other than JFIF, ICC, Adobe; comments). */
function keepSegment(bytes, s) {
  const m = s.marker;
  if (m === COM) return false;
  if (m === APP0) return startsWith(bytes, s.start + 4, 'JFIF\0') || startsWith(bytes, s.start + 4, 'JFXX\0');
  if (m === APP2) return startsWith(bytes, s.start + 4, 'ICC_PROFILE\0'); // colours of the photo
  if (m === APP14) return true; // Adobe: colour transform, needed to decode
  if (m >= APP1 && m <= 0xef) return false;
  return true;
}

/**
 * The JPEG without its metadata (see above). Throws if it is not a JPEG.
 * @returns {{ bytes: Uint8Array, orientation: number, removed: boolean }}
 */
export function stripJpegMetadata(input) {
  if (!isJpeg(input)) throw new Error('Ce fichier n’est pas une photo JPEG.');
  const info = jpegExifInfo(input);
  const orientation = info.orientation >= 1 && info.orientation <= 8 ? info.orientation : 1;
  const parts = [new Uint8Array([0xff, SOI])];
  let removed = false;
  let p = 2;
  let insertedExif = false;
  const addExif = () => {
    if (!insertedExif && orientation !== 1) parts.push(orientationSegment(orientation));
    insertedExif = true;
  };
  // Header segments, then the picture data (scans), then stop at the end of
  // the picture: anything appended after it is dropped.
  for (;;) {
    if (p + 2 > input.length) throw new Error('JPEG incomplet.');
    if (input[p] !== 0xff) throw new Error('JPEG abîmé (segment attendu).');
    while (input[p + 1] === 0xff) p++;
    const marker = input[p + 1];
    if (marker === EOI) { parts.push(new Uint8Array([0xff, EOI])); p += 2; break; }
    const len = (input[p + 2] << 8) | input[p + 3];
    const s = { marker, start: p, end: p + 2 + len };
    if (s.end > input.length) throw new Error('JPEG incomplet.');
    if (marker !== APP0 || !keepSegment(input, s)) addExif();
    if (keepSegment(input, s)) parts.push(input.subarray(s.start, s.end));
    else removed = true;
    p = s.end;
    if (marker === SOS) {
      // Entropy-coded data: up to the next marker that is not a stuffed
      // 0xFF00, a restart marker (RSTn) or a fill byte.
      let q = p;
      while (q + 1 < input.length) {
        if (input[q] === 0xff) {
          const n = input[q + 1];
          if (n === 0x00 || (n >= 0xd0 && n <= 0xd7) || n === 0xff) { q += n === 0xff ? 1 : 2; continue; }
          break;
        }
        q++;
      }
      parts.push(input.subarray(p, q));
      p = q;
      if (q + 1 >= input.length) { parts.push(new Uint8Array([0xff, EOI])); break; } // EOI missing: added
    }
  }
  if (p < input.length) removed = true; // extra pictures after the photo
  if (info.exif) removed = true;
  const total = parts.reduce((n, a) => n + a.length, 0);
  const bytes = new Uint8Array(total);
  let o = 0;
  for (const a of parts) { bytes.set(a, o); o += a.length; }
  return { bytes, orientation, removed };
}
