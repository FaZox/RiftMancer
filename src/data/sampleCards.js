// Domain color mapping for UI (matches lowercase domain IDs from the card database)
export const DOMAIN_COLORS = {
  // Couleurs officielles des domaines de Riftbound
  fury:      { bg: 'bg-domain-fury/20',      text: 'text-[#ff8a80]', border: 'border-domain-fury/50',      hex: '#e2463a' },
  calm:      { bg: 'bg-domain-calm/20',      text: 'text-[#7fd6a4]', border: 'border-domain-calm/50',      hex: '#3fb27f' },
  mind:      { bg: 'bg-domain-mind/20',      text: 'text-[#8fc4f5]', border: 'border-domain-mind/50',      hex: '#3a8fd9' },
  body:      { bg: 'bg-domain-body/20',      text: 'text-[#f5b47a]', border: 'border-domain-body/50',      hex: '#e8863a' },
  chaos:     { bg: 'bg-domain-chaos/20',     text: 'text-[#cdb0f5]', border: 'border-domain-chaos/50',     hex: '#9b5de5' },
  order:     { bg: 'bg-domain-order/20',     text: 'text-[#f0d77a]', border: 'border-domain-order/50',     hex: '#e3c04a' },
  colorless: { bg: 'bg-domain-colorless/20', text: 'text-rift-400',  border: 'border-domain-colorless/50', hex: '#8a93a6' },
};

// Rarity indicators (lowercase keys match card-hashes.json values)
export const RARITY_STYLES = {
  common:   { label: 'C', color: 'text-gray-400' },
  uncommon: { label: 'U', color: 'text-green-400' },
  rare:     { label: 'R', color: 'text-blue-400' },
  epic:     { label: 'E', color: 'text-purple-400' },
  showcase: { label: 'S', color: 'text-amber-400' },
};

// Determines if a card is exclusively foil (no standard version exists)
export function isFoilOnly(card) {
  const rarity = (card.rarity || '').toLowerCase();
  const id = (card.id || '').toLowerCase();
  const code = (card.code || '');
  const collectorNumber = card.collectorNumber || '';

  // Star variants are always foil (id: "ogn-309-star-298", code: "OGN-309*/298")
  if (id.includes('star') || code.includes('*')) {
    return true;
  }

  // Overnumbered cards (collector number > set total) are showcase/foil
  const codeParts = code.split('/');
  if (codeParts.length === 2) {
    const num = parseInt(collectorNumber.replace(/\D/g, '')) || 0;
    const total = parseInt(codeParts[1]) || 0;
    if (num > 0 && total > 0 && num > total) {
      return true;
    }
  }

  // These rarities are exclusively foil
  const foilOnlyRarities = ['rare', 'epic', 'legendary', 'showcase', 'legend'];
  return foilOnlyRarities.includes(rarity);
}

// Conditions: Cardmarket's scale (src/lib/conditions.js)
export { CONDITIONS } from '../lib/conditions.js';

// Language options
export const LANGUAGES = [
  { value: 'English', label: 'Anglais', short: 'EN' },
  { value: 'French', label: 'Français', short: 'FR' },
  { value: 'Chinese', label: 'Chinois', short: 'CN' },
];

// ─── French labels for card attributes (display only; data values stay English) ──
const DOMAIN_FR = { fury: 'Fureur', calm: 'Calme', mind: 'Esprit', body: 'Corps', chaos: 'Chaos', order: 'Ordre', colorless: 'Incolore' };
const RARITY_FR = { common: 'Commune', uncommon: 'Peu commune', rare: 'Rare', epic: 'Épique', showcase: 'Showcase' };
const TYPE_FR = { unit: 'Unité', spell: 'Sort', gear: 'Équipement', legend: 'Légende', battlefield: 'Champ de bataille', rune: 'Rune' };

export const domainLabel = (d) => DOMAIN_FR[d] || d;
export const rarityLabel = (r) => RARITY_FR[r] || r;
export const typeLabel = (t) => TYPE_FR[t] || t;
