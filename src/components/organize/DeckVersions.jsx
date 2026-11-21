import React, { useMemo, useState } from 'react';
import { ChevronDown, History, Save } from 'lucide-react';
import Sheet from '../common/Sheet.jsx';
import DiffList from '../common/DiffList.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { currentVersion, saveVersion, changedSinceVersion, diffVersions, versionStats } from '../../lib/deckVersions.js';
import { tx, locale } from '../../lib/i18n.js';

/**
 * « v3 ▾ » next to the deck's name (lot 7.3, B.6.3, pc-06): the versions (name,
 * date, win rate), « Enregistrer une version… » and « Comparer… » (DiffList).
 */
const day = (t) => new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
const ZONE = { main: '', rune: 'rune', battlefield: 'champ de bataille', side: tx('réserve'), legend: tx('Légende'), champion: 'champion' };
const nameOf = (id) => { const c = getMatcher().getCardData(id); return c ? getLocalizedName(c, displayLanguage()) : id; };

export default function DeckVersions({ deck, matches, onSave }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [cmp, setCmp] = useState(null); // [a, b]: version numbers, 0 = the deck now
  const n = currentVersion(deck);
  const versions = deck.versions || [];
  const stats = useMemo(() => versionStats(matches, deck.id), [matches, deck.id]);
  const changed = changedSinceVersion(deck);
  const listOfN = (k) => (k === 0 ? deck : versions.find(v => v.n === k));
  const diff = cmp && listOfN(cmp[0]) && listOfN(cmp[1]) ? diffVersions(listOfN(cmp[0]), listOfN(cmp[1])) : null;
  const label = (k) => (k === 0 ? tx('Maintenant') : `v${k}${versions.find(v => v.n === k)?.name ? ` · ${versions.find(v => v.n === k).name}` : ''}`);
  const line = (s, op) => ({ op, label: `${s.quantity > 1 ? `${s.quantity} × ` : ''}${nameOf(s.cardId)}`, cardId: s.cardId, detail: ZONE[s.zone] || '' });

  const save = () => { onSave(saveVersion(deck, name)); setName(''); };
  return (
    <>
      <button type="button" className="chip h-9 min-h-[36px]" onClick={() => setOpen(true)} aria-label={tx('Versions du deck{v0}', { v0: n ? ` (version ${n})` : '' })}>
        {n ? `v${n}${changed ? '*' : ''}` : tx('Versions')} <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={() => { setOpen(false); setCmp(null); }} title={tx('Versions')}>
        <div className="space-y-4">
          {!versions.length && <p className="text-[14px] text-rift-400">{tx('Aucune version pour l’instant. Enregistrez la liste avant un tournoi : les matchs garderont la version jouée.')}</p>}
          <ul className="divide-y divide-rift-700">
            {[...versions].reverse().map(v => {
              const st = stats.get(v.n);
              return (
                <li key={v.n} className="flex items-center gap-3 py-2">
                  <History size={16} className="text-gold-400 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] text-rift-100 truncate">v{v.n}{v.name ? ` · ${v.name}` : ''}{v.n === n ? ' · actuelle' : ''}</span>
                    <span className="block text-[12px] text-rift-400">{day(v.at)}{st ? ` · ${st.rate} % · ${st.games} partie${st.games > 1 ? 's' : ''}` : ''}</span>
                  </span>
                  <button onClick={() => setCmp([v.n, 0])} className="btn-ghost min-h-[36px] px-2 text-[13px]">{tx('Comparer')}</button>
                </li>
              );
            })}
          </ul>
          <div className="space-y-2">
            <label className="block text-[13px] text-rift-300" htmlFor="version-name">{tx('Enregistrer la liste actuelle')}{changed ? '' : tx(' (identique à la dernière version)')}</label>
            <div className="flex gap-2">
              <input id="version-name" value={name} onChange={e => setName(e.target.value)} placeholder={tx('Nom (ex. « après le tournoi »)')} maxLength={60}
                className="flex-1 min-w-0 h-10 bg-rift-800 border border-rift-600/40 text-[14px] text-rift-100 px-2" />
              <button onClick={save} disabled={!changed} className="btn-primary min-h-[40px] px-3 text-[14px]"><Save className="w-4 h-4" /> {tx('Enregistrer')}</button>
            </div>
          </div>
          {versions.length > 0 && (
            <div className="space-y-2 border-t border-rift-700 pt-3">
              <p className="text-[13px] text-rift-300">{tx('Comparer')}</p>
              <div className="flex items-center gap-2 text-[14px]">
                {[0, 1].map(i => (
                  <select key={i} aria-label={i ? tx('Vers') : tx('Depuis')} value={cmp?.[i] ?? (i ? 0 : n)} onChange={e => setCmp(c => { const x = [...(c || [n, 0])]; x[i] = Number(e.target.value); return x; })}
                    className="flex-1 min-w-0 h-10 bg-rift-800 border border-rift-600/40 text-rift-100 px-2">
                    {[...versions.map(v => v.n), 0].map(k => <option key={k} value={k}>{label(k)}</option>)}
                  </select>
                ))}
              </div>
              {!cmp && <button onClick={() => setCmp([n, 0])} className="btn-ghost min-h-[36px] px-3 text-[13px]">{tx('Comparer v')}{n} {tx('et maintenant')}</button>}
              {diff && (diff.added.length || diff.removed.length
                ? <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-[12px] text-state-ok mb-1">{tx('Ajoutées')}</p>{diff.added.length ? <DiffList items={diff.added.map(s => line(s, '+'))} /> : <p className="text-[13px] text-rift-400">{tx('Aucune')}</p>}</div>
                    <div><p className="text-[12px] text-state-bad mb-1">{tx('Retirées')}</p>{diff.removed.length ? <DiffList items={diff.removed.map(s => line(s, '-'))} /> : <p className="text-[13px] text-rift-400">{tx('Aucune')}</p>}</div>
                  </div>
                : <p className="text-[14px] text-rift-400">{tx('Les deux listes sont identiques.')}</p>)}
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
