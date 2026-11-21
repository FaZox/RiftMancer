/**
 * Opening hand simulator (deck editor « Main de départ »).
 * Shuffles the main deck, draws the opening hand, applies the mulligan rule
 * (set aside up to GAME.mulliganMax cards, draw as many, the set-aside cards
 * go to the bottom of the deck), then « Piocher » draws one card per turn.
 */
import { GAME } from './probability.js';

/** Main deck as a flat list of card ids (one entry per copy). */
export function expandMainDeck(deck) {
  const out = [];
  for (const s of deck.cards || []) {
    if (s.zone !== 'main') continue;
    for (let i = 0; i < s.quantity; i++) out.push(s.cardId);
  }
  return out;
}

export function shuffle(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The deck that is shuffled: the main deck minus ONE copy of the Chosen
 * Champion, placed in the Champion Zone before the game (Core Rules
 * 103.2.a.1, « How to Play » Origins) — 39 cards for a 40-card deck. The
 * other copies of the champion stay in the deck.
 */
export function expandLibrary(deck) {
  const list = expandMainDeck(deck);
  if (deck.championId) {
    const i = list.indexOf(deck.championId);
    if (i >= 0) list.splice(i, 1);
  }
  return list;
}

/** True when the Chosen Champion is in the main deck (so it starts in the Champion Zone). */
export function championInZone(deck) {
  return !!deck.championId && (deck.cards || []).some(s => s.zone === 'main' && s.cardId === deck.championId && s.quantity > 0);
}

/** New game: { library, hand, drawn: 0, mulliganDone: false } */
export function newHand(deck, { rand = Math.random, game = GAME } = {}) {
  const library = shuffle(expandLibrary(deck), rand);
  const hand = library.splice(0, game.handSize);
  return { library, hand, turn: 0, mulliganDone: false };
}

/**
 * Mulligan: the cards at `indexes` (at most game.mulliganMax) are replaced by
 * the next cards; they go to the bottom of the deck. Only once per game.
 */
export function mulligan(state, indexes, { game = GAME } = {}) {
  if (state.mulliganDone) return state;
  const pick = [...new Set(indexes)].filter(i => i >= 0 && i < state.hand.length).slice(0, game.mulliganMax);
  const library = [...state.library];
  const hand = [...state.hand];
  const setAside = pick.map(i => hand[i]);
  const fresh = library.splice(0, pick.length);
  pick.forEach((i, k) => { hand[i] = fresh[k]; });
  library.push(...setAside);
  return { ...state, hand: hand.filter(Boolean), library, mulliganDone: true };
}

/** Draws one card (next turn). */
export function drawCard(state) {
  if (!state.library.length) return state;
  const [card, ...library] = state.library;
  return { ...state, hand: [...state.hand, card], library, turn: state.turn + 1, mulliganDone: true };
}
