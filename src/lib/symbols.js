/**
 * Riftbound's game symbols (Riot Games), in public/sym/: the rarity gems, the
 * domains / runes (fury … order, wild = any rune), Exhaust and the generic rune
 * come from rifthunt.com/sym/; the Might logo from riftmana.com (resized 24×24). Like the card pictures, they stay out
 * of the public repository (scripts/lib/content.mjs): an app built without
 * them keeps its own signs (⚔, no gem). initSymbols() checks once that they are
 * there; symbolsReady() says so.
 */
export const MIGHT_ICON = '/sym/might.svg';
const RARITY_FILE = { common: 'rarity-common.png', uncommon: 'rarity-uncommon.png', rare: 'rarity-rare.png', epic: 'rarity-epic.png', showcase: 'rarity-special.png' };

// Card-type icons (unit, champion, legend, spell, gear, rune, battlefield):
// white glyphs in public/sym/ as type-<id>.png, shown as a CSS mask in the text
// colour (like MASK_ICON). Probed once at startup, so an icon appears as soon
// as its file is added, without a code change.
const TYPE_FILE = {
  unit: 'type-unit.png', champion: 'type-champion.png', legend: 'type-legend.png',
  spell: 'type-spell.png', gear: 'type-gear.png', rune: 'type-rune.png', battlefield: 'type-battlefield.png',
};

let ready = false;
let checking = null;
const available = new Set();

const probe = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve([src, img.naturalWidth > 0]);
  img.onerror = () => resolve([src, false]);
  img.src = src;
});

/** Loads the Might icon once: the symbols are used only when it is there. */
export function initSymbols() {
  if (checking || typeof Image === 'undefined') return checking;
  checking = Promise.all([MIGHT_ICON, ...Object.values(TYPE_FILE).map(f => `/sym/${f}`)].map(probe)).then((entries) => {
    for (const [src, ok] of entries) {
      if (!ok) continue;
      if (src === MIGHT_ICON) ready = true; else available.add(src);
    }
    return ready;
  });
  return checking;
}

export const symbolsReady = () => ready;

/** Picture of a rarity's gem (null when unknown or the symbols are missing). */
export const rarityIcon = (rarity) => (ready && RARITY_FILE[rarity] ? `/sym/${RARITY_FILE[rarity]}` : null);

const DOMAINS = ['fury', 'calm', 'mind', 'body', 'chaos', 'order', 'colorless'];
/** Icon of a domain (its rune), in colour; « rainbow » (any rune) → wild. null when unknown or missing. */
export function domainIcon(domain) {
  if (!ready) return null;
  if (domain === 'rainbow' || domain === 'wild') return '/sym/wild.svg';
  return DOMAINS.includes(domain) ? `/sym/${domain}.svg` : null;
}
/** Mask of a card type's icon (white glyph, tinted by the text colour); null when unknown, missing or the symbols are absent. */
export function typeIcon(type) {
  if (!ready || !TYPE_FILE[type]) return null;
  const src = `/sym/${TYPE_FILE[type]}`;
  return available.has(src) ? src : null;
}
/** White shapes, shown in the colour of the text (CSS mask), like on the card. */
export const MASK_ICON = { might: MIGHT_ICON, exhaust: '/sym/exhaust.svg', rune: '/sym/rune.svg' };
