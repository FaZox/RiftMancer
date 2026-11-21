/**
 * The scanner learns from the user's corrections.
 *
 * When the user picks the card himself (« Pas la bonne carte », « laquelle
 * est-ce ? », another candidate on a photo), the fingerprint of that photo is
 * kept as one more reference picture of the chosen card (synced collection
 * « learned »: { id, cardId, f (base64 16×16×3), e ({ [AI engine]: vector },
 * see cardMatcher.learnSampleAI), createdAt, updatedAt, deleted }).
 * The matcher compares the next photos with the catalog AND these examples
 * (CardMatcher.setLearned) — with his phone, his light, his sleeves.
 *
 * Guard rails: only the user's own choices are learned (never an automatic
 * match, which would reinforce its own mistakes); a photo that looks clearly
 * more like another artwork is not learned (probably a wrong choice); at most
 * MAX_PER_CARD examples per card (the most recent); learned examples weigh
 * less than the catalog (matchIndex LEARNED_PENALTY); Réglages → « Oublier ».
 *
 * Bench (npm run eval:matcher -- --learn, 400 cards, Prudent mode, the later
 * photos simulated in OTHER conditions than the corrected ones): right card
 * first 77.0 → 79.3 %, taken right 58.3 → 62.3 %, asked 41.5 → 37.5 %, wrong
 * cards 0.3 → 0.3 %, cards absent from the catalog taken 0.3 → 0.3 %.
 * With a smaller handicap (0.06) the gain looked bigger but the cards absent
 * from the catalog taken rose (up to 25 % in « Rapide » mode). Simulated
 * photos only — to be confirmed on real photos.
 */
import { useEffect, useState } from 'react';
import { loadRecords, putRecords, newId, onExternalChange } from './collectionDB.js';
import { getMatcher } from './cardMatcher.js';
import { getPrefs } from './uiPrefs.js';

export const LEARNED = 'learned';
const MAX_PER_CARD = 5;

let items = [];
const subs = new Set();
let started = false;

function apply() {
  getMatcher().setLearned(items);
  for (const fn of subs) fn(items.length);
}

async function reload() {
  try {
    items = await loadRecords(LEARNED);
    apply();
  } catch (err) {
    console.warn('[learning] load failed:', err);
  }
}

/** Loads the learned examples (startup) and follows the ones received by sync. */
export async function initLearning() {
  if (started) return;
  started = true;
  await reload();
  onExternalChange(reload);
}

export function learningEnabled() {
  return getPrefs().learnFromCorrections !== false;
}

/**
 * The user chose `cardId` for this scan: learn it when the matcher was wrong
 * or hesitated. `match` is the matcher's result (it carries learnSample).
 * @returns {Promise<boolean>} true when an example was saved
 */
export async function learnFromChoice(match, cardId) {
  if (!learningEnabled() || !cardId || typeof match?.learnSample !== 'function') return false;
  // Nothing to learn when the matcher had it right and was sure enough to add it.
  if (match.accepted && match.card?.id === cardId) return false;
  const f = match.learnSample(cardId);
  if (!f) return false;
  const now = Date.now();
  const same = items.filter(r => r.cardId === cardId).sort((a, b) => a.createdAt - b.createdAt);
  const drop = same.slice(0, Math.max(0, same.length - (MAX_PER_CARD - 1)))
    .map(r => ({ ...r, deleted: true, updatedAt: now }));
  // The AI vector too (per engine: still useful if the user switches engines;
  // an engine that finds none of its own uses the card's catalog vector).
  const e = typeof match.learnSampleAI === 'function' ? match.learnSampleAI(cardId) : null;
  const rec = { id: newId(), cardId, f, ...(e ? { e } : {}), createdAt: now, updatedAt: now, deleted: false };
  items = [...items.filter(r => !drop.some(d => d.id === r.id)), rec];
  apply();
  await putRecords(LEARNED, [...drop, rec]);
  return true;
}

/** Réglages → « Oublier ce que l'app a appris » (synced: the other device forgets too). */
export async function forgetLearning() {
  const now = Date.now();
  const all = items.map(r => ({ ...r, deleted: true, updatedAt: now }));
  items = [];
  apply();
  await putRecords(LEARNED, all);
}

/** Number of learned examples (re-renders when it changes). */
export function useLearnedCount() {
  const [n, setN] = useState(items.length);
  useEffect(() => {
    subs.add(setN);
    setN(items.length);
    return () => subs.delete(setN);
  }, []);
  return n;
}

/** Number of different cards with learned examples. */
export function learnedCardCount() {
  return new Set(items.map(r => r.cardId)).size;
}
