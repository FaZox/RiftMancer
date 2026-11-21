import React, { useState } from 'react';
import OrganizeTab from './OrganizeTab.jsx';
import { peekRequest } from '../../lib/navRequest.js';
import MatchesView from '../matches/MatchesView.jsx';
import CounterFab from '../matches/CounterFab.jsx';
import SearchButton from '../common/SearchButton.jsx';
import { tx } from '../../lib/i18n.js';

const KEY = 'rb.decksView';
const readView = () => { try { return localStorage.getItem(KEY) === 'matches' ? 'matches' : 'decks'; } catch { return 'decks'; } };

/**
 * Phone « Decks » tab (B.3): two segments `Decks | Matchs` — the matches left
 * « Plus » — and the « Compteur » button in one gesture on both.
 */
export default function DecksTab({ collection, org, wishlist, onAddCopy, showNotification }) {
  const [view, setView] = useState(() => (peekRequest()?.kind === 'deck' ? 'decks' : readView()));
  const [deckOpen, setDeckOpen] = useState(false);
  const choose = (v) => { setView(v); try { localStorage.setItem(KEY, v); } catch { /* ignore */ } };
  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {!deckOpen && (
        <div className="px-4 pt-5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="h-title text-[22px] flex-1">{tx('Decks')}</h1>
            <SearchButton />
          </div>
          <div className="seg mt-3 mb-1" role="tablist" aria-label={tx('Decks ou matchs')}>
            <button role="tab" aria-selected={view === 'decks'} onClick={() => choose('decks')}>{tx('Decks')}</button>
            <button role="tab" aria-selected={view === 'matches'} onClick={() => choose('matches')}>{tx('Matchs')}</button>
          </div>
        </div>
      )}
      {view === 'decks' ? (
        <OrganizeTab collection={collection} org={org} wishlist={wishlist} onAddCopy={onAddCopy} fixedView="decks" hideHeader
          onDeckOpen={setDeckOpen} showNotification={showNotification} />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <MatchesView org={org} showNotification={showNotification} counterButton={false} />
        </div>
      )}
      {/* the open deck shows its own button (its deck and Legend already chosen) */}
      {!deckOpen && <CounterFab org={org} showNotification={showNotification} />}
    </div>
  );
}
