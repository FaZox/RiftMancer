import { useMemo } from 'react';
import { getMatcher } from '../lib/cardMatcher.js';
import {
  validateDeck, deckOwnership, copiesToAssign, zoneForCard, cardKey,
} from '../lib/deckRules.js';
import { usePrices, unitPrice } from '../lib/prices.js';
import { useDialog } from '../components/common/Dialog.jsx';
import { tx } from '../lib/i18n.js';

/**
 * Everything one can do to a deck (contents, rules check, physical copies,
 * loan, value) — shared by the phone editor (components/organize/DeckEditor)
 * and the PC one (desktop/pages/DecksPage).
 */
export default function useDeckEditor({ deck, decks, org, copies, collection, wishlist }) {
  const { ask, inform } = useDialog();
  const m = getMatcher();
  const { people, loans } = org;
  const activeLoan = loans.items.find(l => l.deckId === deck.id && !l.returnedAt);
  const lendable = useMemo(() => copies.filter(c => c.deckId === deck.id && !c.loanId), [copies, deck.id]);
  const check = useMemo(() => validateDeck(deck), [deck]);
  const own = useMemo(() => deckOwnership(deck, copies), [deck, copies]);
  const inThisDeck = useMemo(() => copies.filter(c => c.deckId === deck.id).length, [copies, deck.id]);
  const legend = check.legend;
  const { prices } = usePrices();
  // Deck value (list at trend price) and what the missing cards would cost.
  const money = useMemo(() => {
    if (!prices) return null;
    let value = 0; let missingCost = 0; let unpriced = 0;
    const items = [...(deck.cards || [])];
    if (deck.legendId) items.push({ cardId: deck.legendId, quantity: 1 });
    const missingLeft = new Map();
    for (const it of items) {
      const c = m.getCardData(it.cardId);
      const p = unitPrice(prices, it.cardId, false);
      if (p == null) { unpriced += it.quantity; continue; }
      value += p * it.quantity;
      const k = cardKey(c);
      if (c && !missingLeft.has(k)) missingLeft.set(k, own.byName.get(k)?.missing || 0);
      const miss = Math.min(it.quantity, missingLeft.get(k) || 0);
      if (miss > 0) { missingCost += miss * p; missingLeft.set(k, missingLeft.get(k) - miss); }
    }
    return { value, missingCost, unpriced };
  }, [prices, deck, own, m]);
  const champion = check.champion;

  const save = (patch) => decks.save({ ...deck, ...patch });
  const slots = deck.cards || [];
  const countOf = (cardId) => slots.filter(s => s.cardId === cardId).reduce((n, s) => n + s.quantity, 0);

  const setQty = (cardId, zone, qty) => {
    const rest = slots.filter(s => !(s.cardId === cardId && s.zone === zone));
    save({ cards: qty > 0 ? [...rest, { cardId, zone, quantity: qty }] : rest });
  };
  /** Adds one copy; `toSide` puts it in the sideboard (not runes / battlefields). */
  const addCard = (c, toSide = false) => {
    if (c.type === 'legend') { save({ legendId: c.id }); return 'legend'; }
    const natural = zoneForCard(c);
    // Runes and battlefields never go to the sideboard
    const zone = toSide && natural === 'main' ? 'side' : natural;
    const cur = slots.find(s => s.cardId === c.id && s.zone === zone);
    setQty(c.id, zone, (cur?.quantity || 0) + 1);
  };
  const pickChampion = (c) => {
    const patch = { championId: c.id };
    if (!slots.some(s => s.cardId === c.id && s.zone === 'main')) {
      patch.cards = [...slots, { cardId: c.id, zone: 'main', quantity: 1 }];
    }
    save(patch);
  };

  const assign = () => {
    const ids = copiesToAssign(deck, copies);
    if (ids.length === 0) { inform({ title: tx('Rien à ranger'), message: tx('Aucun exemplaire libre à mettre dans ce deck.') }); return; }
    collection.patchCopies(ids, { deckId: deck.id, boxId: null });
  };
  const release = async () => {
    if (await ask({ title: tx('Retirer les exemplaires ?'), message: tx('Les {inThisDeck} exemplaires de ce deck redeviennent « sans emplacement ».', { inThisDeck }), confirmLabel: tx('Retirer') })) {
      collection.clearLocation('deckId', deck.id);
    }
  };
  const wishMissing = () => {
    let n = 0;
    for (const s of slots) {
      const c = m.getCardData(s.cardId);
      const o = c && own.byName.get(cardKey(c));
      if (o?.missing > 0) {
        const cur = wishlist.byCard.get(s.cardId)?.quantity || 0;
        wishlist.setWanted(s.cardId, Math.max(cur, o.missing));
        n++;
      }
    }
    inform({ title: tx('Souhaits'), message: n ? tx('{n} carte{v1} ajoutée{v2} à la liste de souhaits.', { n, v1: n > 1 ? 's' : '', v2: n > 1 ? 's' : '' }) : tx('Rien ne manque.') });
  };
  // Moves a slot between the deck and the sideboard.
  const toggleSide = (s) => {
    const to = s.zone === 'side' ? zoneForCard(s.card) : 'side';
    const rest = slots.filter(x => !(x.cardId === s.cardId && (x.zone === s.zone || x.zone === to)));
    const already = slots.find(x => x.cardId === s.cardId && x.zone === to)?.quantity || 0;
    save({ cards: [...rest, { cardId: s.cardId, zone: to, quantity: already + s.quantity }] });
  };
  const lendDeck = (personId) => {
    const loan = loans.save({
      personId, deckId: deck.id, startedAt: Date.now(), returnedAt: null,
      cardIds: lendable.map(c => c.cardId),
    });
    collection.patchCopies(lendable.map(c => c.id), { loanId: loan.id });
  };
  const giveBack = () => {
    collection.clearLocation('loanId', activeLoan.id);
    loans.save({ ...activeLoan, returnedAt: Date.now() });
  };
  const removeDeck = async (onDone) => {
    if (!(await ask({ title: tx('Supprimer le deck « {name} » ?', { name: deck.name }), message: tx('Ses exemplaires redeviennent « sans emplacement ».'), confirmLabel: tx('Supprimer'), destructive: true }))) return;
    collection.clearLocation('deckId', deck.id);
    decks.remove(deck.id);
    onDone?.();
  };


  // Cards still missing (none in this deck, none free), one entry per card name
  const missingItems = useMemo(() => {
    const seen = new Set(); const out = [];
    const all = [...slots, ...(deck.legendId ? [{ cardId: deck.legendId }] : [])];
    for (const s of all) {
      const c = m.getCardData(s.cardId);
      const k = c && cardKey(c);
      if (!c || seen.has(k)) continue;
      seen.add(k);
      const miss = own.byName.get(k)?.missing || 0;
      if (miss > 0) out.push({ cardData: c, quantity: miss });
    }
    return out;
  }, [slots, deck.legendId, own]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    missingItems,
    m, people, loans, activeLoan, lendable, check, own, inThisDeck, legend, champion, prices, money,
    save, slots, countOf, setQty, addCard, pickChampion, assign, release, wishMissing, toggleSide,
    lendDeck, giveBack, removeDeck,
  };
}

/**
 * « In this deck » controls for the card zoom opened from a deck: the − / +
 * change the copies in the deck (never the collection). `side`: the
 * sideboard instead of the deck.
 */
export function deckZoomControls(ed, deck, cardData, side = false) {
  if (!cardData) return null;
  if (cardData.type === 'legend') {
    const count = deck.legendId === cardData.id ? 1 : 0;
    return {
      label: tx('Légende du deck'), count,
      onMinus: () => ed.save({ legendId: null }),
      onPlus: () => { if (!count) ed.save({ legendId: cardData.id }); },
    };
  }
  const natural = zoneForCard(cardData);
  const zone = side && natural === 'main' ? 'side' : natural;
  const count = (deck.cards || []).filter(s => s.cardId === cardData.id && s.zone === zone).reduce((n, s) => n + s.quantity, 0);
  return {
    label: zone === 'side' ? tx('Dans la réserve') : tx('Dans le deck'), count,
    onMinus: () => ed.setQty(cardData.id, zone, count - 1),
    onPlus: () => ed.setQty(cardData.id, zone, count + 1),
  };
}
