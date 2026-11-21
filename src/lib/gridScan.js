/**
 * « Grille » mode of the scanner: a binder page (9 or 12 pockets) or cards
 * laid on a table. The camera watches; when the same cards stay in the same
 * place for a moment, the page is taken as a photo (full size) and checked
 * card by card (PhotoScanView). Pure: tests/gridScan.test.mjs.
 *
 * Why a photo and not live recognition: identifying 9 cards takes ≈ 1.5–2.5 s
 * on a phone — far too slow for every frame. Only the detection (where the
 * cards are, are they sharp) runs live.
 */
import { changedShare } from './handsFree.js';import { tx } from './i18n.js';


export const GRID = {
  interval: 250,     // ms between two looks (plus the detection itself, ≈ 0.5 s on the phone)
  stableLooks: 2,    // looks in a row with the same cards in the same place (≈ 1 s)
  move: 0.035,       // a card « did not move »: its centre within this share of the frame's diagonal
  minCards: 2,       // fewer: the « Caméra » mode is the one for a single card
  pageChange: 0.12,  // after a photo, this share of the picture must change (the next page)
};

/**
 * Same cards in the same place: as many, and each one has a partner whose
 * centre is within `move` × the frame's diagonal. boxes: [{ cx, cy }].
 */
export function sameLayout(a, b, W, H, move = GRID.move) {
  if (!a?.length || !b || a.length !== b.length) return false;
  const lim = move * Math.hypot(W, H);
  const used = new Set();
  for (const p of a) {
    let best = -1;
    let bestD = Infinity;
    b.forEach((q, j) => {
      if (used.has(j)) return;
      const d = Math.hypot(p.cx - q.cx, p.cy - q.cy);
      if (d < bestD) { bestD = d; best = j; }
    });
    if (best < 0 || bestD > lim) return false;
    used.add(best);
  }
  return true;
}

/**
 * The watcher. step({ boxes, sig, W, H }) after each look — boxes: the sharp
 * cards found, sig: grey signature of the frame (cornerCache.frameSignature) →
 *   { state: 'empty' | 'few', count }   nothing to take yet
 *   { state: 'seen', count }            the page just taken, still in view
 *   { state: 'aiming' | 'settling', count, progress }
 *   { state: 'fire', count }            take the photo now, then captured(sig)
 */
export function createGridWatcher(opts = {}) {
  const o = { ...GRID, ...opts };
  let prev = null;
  let stable = 0;
  let seen = null; // signature of the last page taken
  return {
    step({ boxes, sig = null, W, H }) {
      const count = boxes.length;
      const reset = (state, keep = boxes) => { prev = keep; stable = 0; return { state, count, progress: 0 }; };
      if (seen && sig && changedShare(sig, seen) < o.pageChange) return reset('seen', null); // the next page counts from its own first look
      seen = seen && sig ? null : seen; // the picture changed: the next page
      if (count < o.minCards) return reset(count ? 'few' : 'empty');
      stable = sameLayout(boxes, prev, W, H, o.move) ? stable + 1 : 0;
      prev = boxes;
      if (stable >= o.stableLooks) return { state: 'fire', count, progress: 1 };
      return { state: stable ? 'settling' : 'aiming', count, progress: stable / o.stableLooks };
    },
    /** After a photo: this page is « seen » until the picture changes. */
    captured(sig) { seen = sig; prev = null; stable = 0; },
    reset() { prev = null; stable = 0; seen = null; },
  };
}

/**
 * Reading order of the cards (rows top to bottom, then left to right): the
 * pockets of a binder page are numbered 1…9 this way. boxes: [{ cx, cy, h }]
 * → indices into boxes.
 */
export function readingOrder(boxes) {
  const idx = boxes.map((_, i) => i);
  if (boxes.length < 2) return idx;
  const hs = boxes.map(b => b.h || 0).sort((a, b) => a - b);
  const tol = (hs[Math.floor(hs.length / 2)] || 1) * 0.5;
  const rows = [];
  for (const i of idx.sort((i, j) => boxes[i].cy - boxes[j].cy)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(boxes[i].cy - row.cy) <= tol) {
      row.items.push(i);
      row.cy = row.items.reduce((s, k) => s + boxes[k].cy, 0) / row.items.length;
    } else rows.push({ cy: boxes[i].cy, items: [i] });
  }
  return rows.flatMap(r => r.items.sort((i, j) => boxes[i].cx - boxes[j].cx));
}

const s = (n) => (n > 1 ? 's' : '');

/** What the screen says while aiming. */
export function gridHint(state, count = 0) {
  switch (state) {
    case 'empty': return tx('Visez une page de classeur ou des cartes posées à plat');
    case 'few': return tx('{count} carte trouvée : cadrez-en au moins 2 (une seule carte : mode Caméra)', { count });
    case 'seen': return tx('Page prise : tournez la page');
    case 'fire': return 'Photo…';
    case 'aiming':
    case 'settling': return `${count} carte${s(count)} · ne bougez plus`;
    default: return tx('Chargement de l’IA…');
  }
}

/** The session so far: « Page 3 · 21 cartes ajoutées » (page = the one being taken). */
export function sessionLine({ pages = 0, cards = 0 } = {}) {
  const page = `Page ${pages + 1}`;
  return cards ? tx('{page} · {cards} carte{s} ajoutée{s2}', { page, cards, s: s(cards), s2: s(cards) }) : page;
}

/** Groups of close values (gap ≤ tol), in ascending order → group index of each value and the number of groups. */
function bands(values, tol) {
  const order = values.map((_, i) => i).sort((i, j) => values[i] - values[j]);
  const of = new Array(values.length);
  let k = -1;
  let last = -Infinity;
  for (const i of order) {
    if (values[i] - last > tol) k++;
    of[i] = k;
    last = values[i];
  }
  return { of, n: k + 1 };
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 1;
};

/**
 * The pocket of each card on a binder page (step 3): rows and columns from
 * the card centres (a gap of more than half a card starts a new one), pocket =
 * row × columns + column + 1 — an empty pocket keeps the numbering as long
 * as its column and its row hold another card. boxes: [{ cx, cy, w, h }]
 * → { slots: [1…], cols }.
 */
export function gridSlots(boxes) {
  if (!boxes.length) return { slots: [], cols: 0 };
  const rows = bands(boxes.map(b => b.cy), median(boxes.map(b => b.h)) * 0.5);
  const cols = bands(boxes.map(b => b.cx), median(boxes.map(b => b.w)) * 0.5);
  return { slots: boxes.map((_, i) => rows.of[i] * cols.n + cols.of[i] + 1), cols: cols.n };
}
