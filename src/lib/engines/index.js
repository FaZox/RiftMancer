/**
 * Recognition « engines »: they turn a straightened card image (RGBA, w × h)
 * into vectors that MatchIndex compares with the catalog's.
 *
 *   interface Engine {
 *     id: string;               // 'grid16', 'dinov2s', …
 *     dim: number;
 *     regions: string[];        // 'art' (illustration only, crop per artBottom) | 'full' (whole card)
 *     init(opts): Promise<void>;
 *     // One entry per orientation tested: { name, byBottom: Map(key → Float32Array) }
 *     //   key = the artBottom for 'art', FULL_KEY for 'full'.
 *     embed(rgba, w, h, { region, bottoms, views }): Promise<{ name, byBottom }[]>;
 *     // The vector of a catalog image (upright, its own crop).
 *     embedCatalog(rgba, w, h, { region, bottom }): Promise<Float32Array>;
 *   }
 *
 * Works in the browser (onnxruntime-web) and in Node (onnxruntime-node, the
 * test bench): the ONNX module is passed in `init`.
 */
export const FULL_KEY = 1; // « bottom » key of the whole-card region

export { grid16 } from './grid16.js';
export { createOnnxEngine, ENGINE_CONFIGS } from './onnxEngine.js';

/**
 * Embedding of an AI model → compact text (catalog field `e`, learned examples):
 * base64 of [float32 scale][int8 × dim], value = int8 × scale. A 384-value
 * DINOv2 vector takes 388 bytes (520 characters) instead of 1.5 KB of floats;
 * cosine with the original ≥ 0.9999.
 */
export function encodeEmbedding(v) {
  let max = 0;
  for (let i = 0; i < v.length; i++) max = Math.max(max, Math.abs(v[i]));
  const scale = max / 127 || 1;
  const bytes = new Uint8Array(4 + v.length);
  new DataView(bytes.buffer).setFloat32(0, scale, true);
  for (let i = 0; i < v.length; i++) bytes[4 + i] = Math.max(-127, Math.min(127, Math.round(v[i] / scale))) & 0xff;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(bin) : globalThis.Buffer.from(bin, 'latin1').toString('base64');
}

export function decodeEmbedding(text) {
  const bin = typeof atob === 'function' ? atob(text) : globalThis.Buffer.from(text, 'base64').toString('latin1');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const scale = new DataView(bytes.buffer).getFloat32(0, true);
  const v = new Float32Array(bytes.length - 4);
  for (let i = 0; i < v.length; i++) v[i] = ((bytes[4 + i] << 24) >> 24) * scale;
  return v;
}
