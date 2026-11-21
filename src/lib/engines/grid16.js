/**
 * Engine « grid16 »: the colour grid fingerprint (fingerprint.js), unchanged —
 * illustration only, 16 × 16 × 3 values, 4 orientations.
 */
import { gridFeatures, queryViews } from '../fingerprint.js';

export const grid16 = {
  id: 'grid16',
  dim: 768,
  regions: ['art'],
  size: 0,
  async init() {},
  async embed(rgba, w, h, { bottoms }) {
    return queryViews(rgba, w, h, bottoms, 16);
  },
  async embedCatalog(rgba, w, h, { bottom }) {
    return gridFeatures(rgba, w, h, bottom, 16);
  },
};
