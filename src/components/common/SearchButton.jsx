import React from 'react';
import { Search } from 'lucide-react';
import { requestOpen } from '../../lib/navRequest.js';
import { tx } from '../../lib/i18n.js';

/** Magnifier of the phone's Collection and Decks headers (B.3): the global search. */
export default function SearchButton() {
  return (
    <button type="button" onClick={() => requestOpen({ kind: 'search' })} aria-label={tx('Rechercher')}
      className="w-11 h-11 -mr-2 flex items-center justify-center text-rift-200 active:text-gold-400">
      <Search size={20} />
    </button>
  );
}
