import React, { useCallback, useState } from 'react';
import CardReliquary from './CardReliquary.jsx';

/**
 * The PC card sheet of a page: `open(cardId, { list, language, forge })` and the element to render.
 * `list`: ids of the cards to browse (the carousel); `forge`: open with the « ＋ Ma collection » panel.
 * ⚠️ Always passes byCard={wishlist.byCard} next to wanted (the heart of a variant, see CLAUDE.md).
 */
export default function useReliquary({ stacks, wishlist, onAddCopy, onAddCopies, onRemoveCopy, onUpdateCard, org, defaultLanguage }) {
  const [zoom, setZoom] = useState(null); // { cardId, language, list, forge, n }
  const open = useCallback((cardId, { list = null, language = 'French', forge = false } = {}) => {
    setZoom(z => ({ cardId, language, list, forge, n: (z?.n || 0) + 1 }));
  }, []);
  const close = useCallback(() => setZoom(null), []);
  const element = zoom ? (
    <CardReliquary
      key={zoom.n}
      cardId={zoom.cardId}
      language={zoom.language}
      list={zoom.list}
      forge={zoom.forge}
      stacks={stacks}
      wanted={wishlist.byCard.get(zoom.cardId)?.quantity || 0}
      byCard={wishlist.byCard}
      onSetWanted={wishlist.setWanted}
      onAddCopy={onAddCopy}
      onAddCopies={onAddCopies}
      onRemoveCopy={onRemoveCopy}
      onUpdateCard={onUpdateCard}
      org={org}
      defaultLanguage={defaultLanguage}
      onClose={close}
    />
  ) : null;
  return { open, element };
}
