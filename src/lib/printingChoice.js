/**
 * The printing chosen for an artwork printed several times (runes of every
 * set, « signée » legends, reprinted tokens): the scanner cannot read the set
 * on the photo (docs/AI-MODELS-REPORT.md § 10), so it asks — and remembers the
 * answer on this device, per artwork, for every scan mode (camera, photos,
 * grid, auto) and the next sessions: a pile of runes of one set is chosen once.
 */
import { getMatcher } from './cardMatcher.js';

const KEY = 'rb.printingChoice';
let memory = null;

function load() {
  if (memory) return memory;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    memory = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { memory = {}; }
  return memory;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* private mode: this session only */ }
}

/** Key of an artwork: the ids of its printings, sorted. */
export const groupKey = (printings) => printings.map(p => p.id).sort().join('|');

/** The printing remembered for these printings of one artwork, or null. */
export function rememberedPrinting(printings) {
  if (!printings || printings.length < 2) return null;
  const id = load()[groupKey(printings)];
  return (id && printings.find(p => p.id === id)) || null;
}

/** Remembers `cardId` as the printing of this artwork. */
export function rememberPrinting(printings, cardId) {
  if (!printings || printings.length < 2 || !printings.some(p => p.id === cardId)) return;
  load()[groupKey(printings)] = cardId;
  save();
}

/** Printings (cardData) of the artwork of `cardId`, itself included; [] when it has no other printing. */
export function printingsOf(cardId, matcher = getMatcher()) {
  const card = matcher?.getCard?.(cardId);
  if (!card?.artGroup) return [];
  const same = matcher.cards.filter(c => c.artGroup === card.artGroup);
  return same.length > 1 ? same.map(c => matcher.getCardData(c.id)) : [];
}

/** Tests: forget everything. */
export function resetPrintingChoice() { memory = {}; save(); }
