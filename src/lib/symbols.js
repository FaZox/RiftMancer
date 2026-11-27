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

let ready = false;
let checking = null;

/** Loads the Might icon once: the symbols are used only when it is there. */
export function initSymbols() {
  if (checking || typeof Image === 'undefined') return checking;
  checking = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { ready = img.naturalWidth > 0; resolve(ready); };
    img.onerror = () => { ready = false; resolve(false); };
    img.src = MIGHT_ICON;
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
/** White shapes, shown in the colour of the text (CSS mask), like on the card. */
export const MASK_ICON = { might: MIGHT_ICON, exhaust: '/sym/exhaust.svg', rune: '/sym/rune.svg' };
