/**
 * Demo data, to try the app without scanning: a small collection, a box, a
 * deck, a loan, a wish list with a price alert, a trade — and, on the phone
 * (or in a browser) without real prices yet, demo Cardmarket prices with a
 * month of history.
 *
 * Every demo record has an id starting with "demo-", so "Retirer les données
 * de démonstration" removes exactly them (as deletions, which also reach the
 * other device at the next sync). Real data is never touched.
 */
import { loadRecords, putRecords, reloadAllViews, isDesktop, getMeta } from './collectionDB.js';
import { getPricesState, savePrices } from './prices.js';import { tx } from './i18n.js';


const PREFIX = 'demo-';
const COLLECTIONS = ['copies', 'wishlist', 'boxes', 'decks', 'people', 'loans', 'trades', 'matches'];

// [cardId, copies, language, paid €, place]
const COPIES = [
  ['ogn-030-298', 3, 'French', 1.5, 'deck'],   // Jinx - Démolisseuse
  ['ogn-004-298', 4, 'English', 0.5, 'deck'],  // Fendoir
  ['ogn-251-298', 1, 'French', 6, 'deck'],     // Jinx - Gâchette folle (Légende)
  ['ogn-202-298', 2, 'English', null, 'box'],  // Jinx - Rebelle
  ['ogn-171-298', 2, 'French', null, 'loan'],  // Poro mystique (prêtées)
  ['ogn-167-298', 3, 'French', null, 'box'],   // Moine ardent
  ['ogn-007-298', 6, 'French', null, 'deck'],  // Rune de fureur
  ['ogn-275-298', 1, 'French', null, 'box'],   // Autel d'unité
  ['ogn-008-298', 2, 'English', null, null],   // Enthousiasme !
];

// Demo prices: [trend, trendFoil, idProduct, avg7, avg30] + a 30-day curve.
const PRICES = {
  'ogn-030-298': [2, 3, 0, 1.5, 1],
  'ogn-004-298': [0.8, null, 0, 1, 1],
  'ogn-251-298': [5, 6, 0, 6, 7],
  'ogn-202-298': [4, 5, 0, 4, 4],
  'ogn-171-298': [1.3, 2, 0, 1.2, 1],
  'ogn-167-298': [0.4, null, 0, 0.4, 0.4],
  'ogn-007-298': [0.1, null, 0, 0.1, 0.1],
  'ogn-275-298': [0.6, null, 0, 0.6, 0.6],
  'ogn-008-298': [0.35, null, 0, 0.4, 0.4],
  'ogn-005-298': [1, null, 0, 2, 2],
};

const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function demoPrices(now) {
  const days = Array.from({ length: 30 }, (_, i) => day(29 - i));
  const cards = {};
  for (const [id, p] of Object.entries(PRICES)) {
    const start = p[4] || p[0];
    // smooth curve from the 30-day average to today's price, with a little noise
    cards[id] = days.map((_, i) => Math.round((start + ((p[0] - start) * i) / 29) * (1 + 0.03 * Math.sin(i / 4)) * 100) / 100);
  }
  return {
    prices: {
      updatedAt: now, priceDate: day(0), source: tx('Démonstration'), demo: true,
      matched: Object.keys(PRICES).length, total: 1408, cards: PRICES, hist: { days, cards },
    },
    history: days.map((d, i) => ({ d, v: Math.round((18 + i * 0.33) * 100) / 100 })),
  };
}

export async function hasDemoData() {
  const copies = await loadRecords('copies');
  return copies.some(c => c.id.startsWith(PREFIX));
}

/** The demo records (pure: also the « base de démonstration » of the diagnostic report test). */
export function demoRecords(now = Date.now()) {
  const rec = (id, fields) => ({ id: PREFIX + id, createdAt: now, updatedAt: now, deleted: false, ...fields });

  const box = rec('box', { name: tx('Boîte démo'), note: '' });
  const person = rec('person', { name: tx('Alex (démo)'), note: '' });
  const loan = rec('loan', { personId: person.id, startedAt: now - 12 * 86400000, returnedAt: null, cardIds: ['ogn-171-298', 'ogn-171-298'], note: '' });
  const deck = rec('deck', {
    name: tx('Jinx Aggro (démo)'), legendId: 'ogn-251-298', championId: 'ogn-030-298', note: '',
    cards: [
      { cardId: 'ogn-030-298', zone: 'main', quantity: 3 },
      { cardId: 'ogn-004-298', zone: 'main', quantity: 3 },
      { cardId: 'ogn-202-298', zone: 'main', quantity: 2 },
      { cardId: 'ogn-008-298', zone: 'main', quantity: 3 },
      { cardId: 'ogn-005-298', zone: 'main', quantity: 3 },
      { cardId: 'ogn-167-298', zone: 'main', quantity: 2 },
      { cardId: 'ogn-007-298', zone: 'rune', quantity: 6 },
      { cardId: 'ogn-275-298', zone: 'battlefield', quantity: 1 },
    ],
  });

  const copies = [];
  let n = 0;
  for (const [cardId, qty, language, paid, place] of COPIES) {
    for (let i = 0; i < qty; i++) {
      copies.push(rec(`copy-${n++}`, {
        cardId, language, foil: false, promo: false, condition: 'Near Mint', paid,
        boxId: place === 'box' ? box.id : null,
        deckId: place === 'deck' ? deck.id : null,
        loanId: place === 'loan' ? loan.id : null,
      }));
    }
  }
  const wish = { ...rec('wish', { cardId: 'ogn-005-298', quantity: 2, maxPrice: 1.5 }), id: 'wish:ogn-005-298', demo: true };
  const trade = rec('trade', {
    personId: person.id, date: now - 3 * 86400000, applied: false, note: tx('Échange de démonstration'),
    given: [{ cardId: 'ogn-167-298', quantity: 1 }], received: [{ cardId: 'ogn-005-298', quantity: 1 }],
  });
  return { box, person, loan, deck, copies, wish, trade };
}

export async function loadDemoData() {
  const now = Date.now();
  const { box, person, loan, deck, copies, wish, trade } = demoRecords(now);
  await putRecords('boxes', [box]);
  await putRecords('people', [person]);
  await putRecords('loans', [loan]);
  await putRecords('decks', [deck]);
  await putRecords('copies', copies);
  // Never replace a real wish list entry for the same card.
  if (!(await loadRecords('wishlist')).some(w => w.id === wish.id)) await putRecords('wishlist', [wish]);
  await putRecords('trades', [trade]);

  // Demo prices only where there are no real ones (never on the PC, which
  // downloads the real Cardmarket prices).
  if (!isDesktop && !getPricesState().prices) await savePrices(demoPrices(now));

  reloadAllViews();
  return copies.length;
}

export async function removeDemoData() {
  const now = Date.now();
  let removed = 0;
  for (const col of COLLECTIONS) {
    const list = (await loadRecords(col)).filter(r => r.id.startsWith(PREFIX) || r.demo);
    if (list.length) await putRecords(col, list.map(r => ({ ...r, deleted: true, updatedAt: now })));
    removed += list.length;
  }
  if (!isDesktop && (await getMeta('prices'))?.prices?.demo) await savePrices({ prices: null, history: [] });
  reloadAllViews();
  return removed;
}
