import React, { useState } from 'react';
import { Timer } from 'lucide-react';
import ScoreCounter from './ScoreCounter.jsx';
import { useLegends } from './MatchesView.jsx';
import { withDeckVersion } from '../../lib/deckVersions.js';
import { tx } from '../../lib/i18n.js';

/**
 * « Compteur » (lot 6 c, B.3, tel-01): gold hexagonal button floating at the
 * bottom right — the points counter in one gesture, from the Decks tab and
 * from an open deck (its Legend and deck already chosen).
 */
export default function CounterFab({ org, deck = null, showNotification = () => {} }) {
  const [open, setOpen] = useState(false);
  const legends = useLegends();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={tx('Compteur de points')}
        className="absolute right-4 bottom-4 z-30 flex flex-col items-center gap-0.5 select-none">
        <span className="hexagon w-14 h-14 flex items-center justify-center bg-gold-500 active:bg-gold-600 shadow-lg">
          <Timer className="w-6 h-6 text-rift-900" strokeWidth={2.4} />
        </span>
        <span className="text-[11px] font-bold text-gold-400 bg-rift-900/80 px-1">{tx('Compteur')}</span>
      </button>
      {open && (
        <ScoreCounter decks={org.decks.items} matches={org.matches.items} legends={legends} defaultDeckId={deck?.id || null} defaultMyLegendId={deck?.legendId || null}
          defaultOppLegendId={null}
          onSave={(m) => { org.matches.save(withDeckVersion(m, org.decks)); showNotification(tx('Match enregistré'), 'success'); }}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}
