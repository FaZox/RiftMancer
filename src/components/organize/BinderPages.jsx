/**
 * The pages of a binder (scanner « Grille », step 3), in the box screen
 * (phone and PC): each page as it is in the binder, pocket by pocket, the
 * empty ones too. Data: binder.js (binderPages).
 */
import React from 'react';
import CardTile from '../collection/CardTile.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { tx } from '../../lib/i18n.js';

export default function BinderPages({ pages, onOpen }) {
  const m = getMatcher();
  return pages.map(p => (
    <section key={p.page} className="space-y-2">
      <h3 className="font-display text-[15px] font-bold text-gold-400">{tx('Page')} {p.page}</h3>
      <div className="grid gap-2 max-w-[640px]" style={{ gridTemplateColumns: `repeat(${p.cols}, minmax(0, 1fr))` }}>
        {p.cells.map(cell => {
          const first = cell.copies[0];
          const d = first && m.getCardData(first.cardId);
          return d ? (
            <CardTile key={cell.slot} cardData={d} badge={cell.copies.length > 1 ? cell.copies.length : undefined} onOpen={onOpen} />
          ) : (
            <div key={cell.slot} className="aspect-[63/88] border border-dashed border-rift-600/60 flex items-center justify-center text-[13px] text-rift-500" title={tx('Case {slot} vide', { slot: cell.slot })}>
              {cell.slot}
            </div>
          );
        })}
      </div>
    </section>
  ));
}
