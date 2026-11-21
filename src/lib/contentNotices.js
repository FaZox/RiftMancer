/**
 * Content updates waiting for a click (lot 4.2 / 4.3): the PC app checks at
 * most once a week, at startup, and says « N traductions nouvelles ou
 * modifiées » — nothing is installed without the user. When the site refuses
 * or is down: no retry loop, at most one reminder a month.
 * State shared by Réglages → Contenu and the settings menu.
 */
import { useEffect, useState } from 'react';
import { getMatcher } from './cardMatcher.js';
import { FR_URLS, buildTranslations, readFrFile, translationChanges } from './frTranslations.js';
import { GALLERY_URL } from './galleryCards.js';
import { RIFTHUNT_CARDS_URL, cardSourceChanges } from './rifthunt.js';import { tx } from './i18n.js';


let notices = {}; // cartes: { count, added, page, validators } · traductions: { count, files, validators } · reminder: { kind, text }
const subs = new Set();
const set = (patch) => { notices = { ...notices, ...patch }; for (const fn of subs) fn(notices); };
export const getNotices = () => notices;
export function useContentNotices() {
  const [n, setN] = useState(notices);
  useEffect(() => { subs.add(setN); return () => subs.delete(setN); }, []);
  return n;
}
export function clearNotice(kind) { set({ [kind]: null, ...(notices.reminder?.kind === kind ? { reminder: null } : {}) }); }

/** French translations of the two files, compared with the catalog in use. */
export function translationsFrom(texts) {
  const files = Object.fromEntries(texts.map(t => { const f = readFrFile(t); return [f.kind, f.data]; }));
  if (!files.repertoire || !files.textes) throw new Error(tx('Il faut les deux fichiers : repertoire-cartes.json et textes-cartes.json.'));
  const cards = getMatcher().cards;
  const tr = buildTranslations(files.repertoire, files.textes, cards);
  return { tr, changes: translationChanges(tr, cards) };
}

/** PC, at startup: the weekly checks (main process: electron/main.cjs content:weeklyCheck). */
export async function runWeeklyChecks(api = window.riftboundDesktop) {
  if (!api?.content?.weeklyCheck) return;
  // New cards (lot 4.2): « N nouvelles cartes disponibles », nothing downloaded without a click.
  try {
    const r = await api.content.weeklyCheck('cartes', [RIFTHUNT_CARDS_URL], [GALLERY_URL]);
    if (r.ok) {
      let page = r.texts[0];
      let ch;
      try {
        ch = cardSourceChanges(page, getMatcher().cards);
      } catch (err) {
        // rifthunt answered something unreadable: Riot's gallery
        if (r.url === GALLERY_URL) throw err;
        const g = await api.content.fetch(GALLERY_URL);
        if (!g.ok) return;
        page = g.text;
        ch = cardSourceChanges(page, getMatcher().cards);
      }
      const count = ch.added.length + ch.changed.length + ch.manualOfficial.length + (ch.links?.length || 0);
      if (count) set({ cartes: { count, added: ch.added.length, page, validators: r.validators } });
      else await api.content.saveValidators('cartes', r.validators);
    }
  } catch (err) {
    console.warn('[content] weekly check (cards):', err);
  }
  try {
    const r = await api.content.weeklyCheck('traductions', FR_URLS);
    if (r.ok) {
      const { changes } = translationsFrom(r.texts);
      if (changes.count) set({ traductions: { count: changes.count, files: r.texts, validators: r.validators } });
      else await api.content.saveValidators('traductions', r.validators); // nothing new: next time, a 304
    } else if (r.failed && r.remind) {
      set({ reminder: { kind: 'traductions', text: tx('Pensez à mettre à jour les traductions françaises : le site n’a pas pu être lu automatiquement.') } });
    }
  } catch (err) {
    console.warn('[content] weekly check:', err);
  }
}
