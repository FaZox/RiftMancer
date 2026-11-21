import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { getSyncLog } from '../../lib/syncClient.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { conflictLine, conflictSummary } from '../../lib/syncConflicts.js';import { tx, locale } from '../../lib/i18n.js';


const COL_FR = { copies: 'cartes', wishlist: 'souhaits', boxes: tx('boîtes'), decks: 'decks', people: 'personnes', loans: tx('prêts'), trades: tx('échanges'), matches: 'matchs', learned: 'exemples appris' };
export const when = (ts) => new Date(ts).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtCounts = (o) => Object.entries(o || {}).map(([k, n]) => `${n} ${COL_FR[k] || k}`).join(', ') || 'rien';

function cardName(cardId) {
  const c = getMatcher().getCardData(cardId);
  return c ? getLocalizedName(c, displayLanguage()) : null;
}

/** « 2 fiches modifiées des deux côtés… », unfolds to the names (lot 3.4). */
function Conflicts({ list, count }) {
  const n = count ?? list.length;
  if (!n) return null;
  return (
    <details className="ml-3 mt-0.5">
      <summary className="cursor-pointer text-state-warn">{conflictSummary(n)}</summary>
      <ul className="ml-3 list-disc">
        {list.map((c, i) => <li key={i}>{conflictLine(c, cardName)}</li>)}
        {n > list.length && <li>{tx('et')} {n - list.length} {tx('autres')}</li>}
      </ul>
    </details>
  );
}

/** Last synchronisations (PC: per phone; phone: what was sent / received). */
export function SyncLog({ refreshKey }) {
  const [log, setLog] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const api = window.riftboundDesktop;
    (api ? api.sync.log() : getSyncLog()).then(setLog).catch(() => setLog([]));
  }, [refreshKey]);
  if (!log.length) return null;
  return (
    <div className="space-y-1">
      <button onClick={() => setOpen(o => !o)} className="text-xs text-gold-400 flex items-center gap-1"><History className="w-3.5 h-3.5" /> {tx('Historique des synchros (')}{log.length})</button>
      {open && (
        <ul className="text-[11px] text-rift-400 space-y-0.5 max-h-64 overflow-y-auto">
          {log.map((l, i) => (
            <li key={i}>
              <span className="text-rift-300">{when(l.at)}</span>
              {l.mode === 'push' ? ' · envoi seul' : l.mode === 'pull' ? tx(' · réception seule') : ''}
              {l.device != null
                ? tx(' · {device} : reçu {received}, appliqué {changed}, envoyé {sent}', { device: l.device, received: l.received, changed: l.changed, sent: l.sent })
                : tx(' · envoyé : {fmtCounts} · reçu : {fmtCounts2}', { fmtCounts: fmtCounts(l.sent), fmtCounts2: fmtCounts(l.received) })}
              <Conflicts list={l.conflicts || []} count={l.conflictCount} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
