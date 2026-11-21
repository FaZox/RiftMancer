import { tx } from './i18n.js';
/**
 * PC keyboard shortcuts (lot 6 i), shown with « ? ». Pure: keyToAction is
 * tested in tests/globalSearch.test.mjs.
 */
export const PAGE_KEYS = ['collection', 'value', 'decks', 'matches', 'scan', 'boxes', 'loans', 'trades'];
const PAGE_LABEL = { collection: tx('Collection'), value: tx('Valeur'), decks: tx('Decks'), matches: tx('Matchs'), scan: tx('Scanner'), boxes: tx('Boîtes'), loans: tx('Prêts'), trades: tx('Échanges et amis') };

export const SHORTCUTS = [
  { keys: tx('Ctrl + K'), label: tx('Rechercher (cartes, decks, boîtes, personnes, réglages)') },
  { keys: tx('Ctrl + N'), label: tx('Ajout rapide d’une carte à la collection') },
  ...PAGE_KEYS.map((p, i) => ({ keys: tx('Ctrl + {v0}', { v0: i + 1 }), label: PAGE_LABEL[p] })),
  { keys: tx('Ctrl + ,'), label: tx('Réglages') },
  { keys: '?', label: tx('Cette liste') },
  { keys: tx('Échap'), label: tx('Fermer une fenêtre') },
];

/** What a key press does: { search } | { add } | { page } | { help } | null. Never while typing. */
export function keyToAction(e, typing = false) {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && (e.key === 'k' || e.key === 'K')) return { search: true };
  if (mod && !e.altKey && (e.key === 'n' || e.key === 'N')) return { add: true };
  if (mod && e.key === ',') return { page: 'settings' };
  if (mod && /^[1-8]$/.test(e.key)) return { page: PAGE_KEYS[Number(e.key) - 1] };
  if (!mod && !typing && e.key === '?') return { help: true };
  return null;
}

/** Is the user typing in a field (then « ? » is a character)? */
export const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
