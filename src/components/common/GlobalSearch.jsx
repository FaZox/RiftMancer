import React, { useEffect, useMemo, useState } from 'react';
import SearchPalette from './SearchPalette.jsx';
import CardZoom from '../collection/CardZoom.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { requestOpen, onRequest } from '../../lib/navRequest.js';
import { tx } from '../../lib/i18n.js';

/**
 * The global search of both apps (lot 6 e): the palette, and what a result
 * does — a card opens its sheet (or, in « ajout rapide », is added to the
 * collection), a deck opens in Decks, a box / a person goes to its page, a
 * settings section opens. `navigate(page, { setting })` moves the app.
 * The phone's magnifiers ask for it with requestOpen({ kind: 'search' }).
 */
export default function GlobalSearch({ open, mode, onClose, onOpen, scannedCards, wishlist, org, collection, onAddCopy, language, notify, navigate }) {
  const [zoom, setZoom] = useState(null);
  useEffect(() => onRequest((r) => { if (r.kind === 'search') onOpen?.(r.mode || 'search'); }), [onOpen]);
  const data = useMemo(() => {
    if (!open) return null;
    const owned = new Map();
    for (const c of collection?.copies || []) owned.set(c.cardId, (owned.get(c.cardId) || 0) + 1);
    return { cards: getMatcher().cards, owned, decks: org?.decks?.items, boxes: org?.boxes?.items, people: org?.people?.items };
  }, [open, collection?.copies, org]);

  const pick = (item) => {
    onClose();
    if (item.type === 'card') {
      if (mode === 'add') { onAddCopy?.(item.cardId, language); notify?.(tx('{label} ajoutée à la collection', { label: item.label }), 'success'); }
      else setZoom(item.cardId);
    } else if (item.type === 'deck') {
      requestOpen({ kind: 'deck', id: item.id });
      navigate('decks');
    } else if (item.type === 'box') navigate('boxes');
    else if (item.type === 'person') navigate('loans');
    else if (item.type === 'setting') navigate('settings', { setting: item.id });
  };

  return (
    <>
      {open && data && <SearchPalette open mode={mode} data={data} onPick={pick} onClose={onClose} />}
      {zoom && (
        <CardZoom cardId={zoom} stacks={scannedCards} wanted={wishlist?.byCard?.get(zoom)?.quantity || 0}
          onSetWanted={wishlist?.setWanted} onAddCopy={onAddCopy} onClose={() => setZoom(null)} />
      )}
    </>
  );
}
