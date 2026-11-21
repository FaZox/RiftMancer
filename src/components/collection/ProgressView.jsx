// « Progression »: completion per set.
import React, { useState, useMemo } from 'react';
import { ChevronDown, Heart } from 'lucide-react';
import CardTile from './CardTile.jsx';
import { catalogSets, compareCollector } from '../../lib/catalog.js';
import { useDialog } from '../common/Dialog.jsx';
import { tx } from '../../lib/i18n.js';

// ─── Progress per set + missing cards ────────────────────────────────────
export function ProgressBar({ value, total }) {
  const pct = total ? Math.round((100 * value) / total) : 0;
  return (
    <div className="h-1.5 rounded-full bg-rift-700 overflow-hidden">
      <div className={`h-full ${pct === 100 ? 'bg-green-400' : 'bg-gold-400'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressView({ ownedByCard, wishlist, onOpen }) {
  const { ask } = useDialog();
  const sets = useMemo(() => catalogSets(), []);
  const [openSet, setOpenSet] = useState(null);
  const [show, setShow] = useState('missing'); // missing | all | owned
  const [withVariants, setWithVariants] = useState(false);

  const count = (cards) => cards.reduce((n, c) => n + (ownedByCard.has(c.id) ? 1 : 0), 0);

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 pt-3 pb-4 space-y-3 lg:px-8 lg:max-w-[1800px]">
        <p className="text-xs text-rift-400">
          {tx('Cartes différentes possédées par extension (toutes langues). « Variantes » = illustrations alternatives, signées, promos et jetons.')}
        </p>
        {sets.map(s => {
          const base = count(s.base);
          const variants = count(s.variants);
          const isOpen = openSet === s.set;
          const pool = withVariants ? s.cards : s.base;
          const shown = pool
            .filter(c => show === 'all' || (show === 'missing' ? !ownedByCard.has(c.id) : ownedByCard.has(c.id)))
            .sort(compareCollector);
          return (
            <div key={s.set} className="rounded-xl bg-rift-800/60 border border-rift-600/20">
              <button onClick={() => setOpenSet(isOpen ? null : s.set)} className="w-full text-left p-3 space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-rift-100">{s.setName}</span>
                  <span className="text-[11px] font-mono text-rift-500">{s.set}</span>
                  <span className="ml-auto text-xs font-mono text-rift-200">{base} / {s.base.length}</span>
                  <ChevronDown className={`w-4 h-4 text-rift-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
                <ProgressBar value={base} total={s.base.length} />
                {s.variants.length > 0 && (
                  <p className="text-[11px] text-rift-500">{tx('Variantes :')} {variants} / {s.variants.length}</p>
                )}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[['missing', tx('Manquantes')], ['owned', tx('Possédées')], ['all', tx('Toutes')]].map(([v, l]) => (
                      <button key={v} onClick={() => setShow(v)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border ${show === v ? 'bg-gold-400/20 text-gold-400 border-gold-400/30' : 'text-rift-400 border-rift-600/30'}`}>
                        {l}
                      </button>
                    ))}
                    <label className="ml-auto flex items-center gap-1.5 text-[11px] text-rift-400">
                      <input type="checkbox" checked={withVariants} onChange={e => setWithVariants(e.target.checked)} />
                      {tx('Inclure les variantes')}
                    </label>
                  </div>
                  {show === 'missing' && shown.length > 0 && (
                    <button
                      onClick={async () => {
                        const toAdd = shown.filter(c => !wishlist.byCard.has(c.id));
                        if (toAdd.length && await ask({ title: tx('Ajouter aux souhaits ?'), message: tx('{length} carte{v1} manquante{v2} ajoutée{v3} à la liste de souhaits.', { length: toAdd.length, v1: toAdd.length > 1 ? 's' : '', v2: toAdd.length > 1 ? 's' : '', v3: toAdd.length > 1 ? 's' : '' }), confirmLabel: tx('Ajouter') })) {
                          toAdd.forEach(c => wishlist.setWanted(c.id, 1));
                        }
                      }}
                      className="btn-ghost text-xs py-1.5 px-3 rounded-xl"
                    >
                      <Heart className="w-3.5 h-3.5" /> {tx('Tout ajouter aux souhaits')}
                    </button>
                  )}
                  {shown.length === 0 ? (
                    <p className="text-xs text-rift-400 py-4 text-center">
                      {show === 'missing' ? tx('Rien ne manque, bravo !') : tx('Aucune carte.')}
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 gap-2 lg:gap-4">
                      {shown.map(c => (
                        <CardTile
                          key={c.id}
                          cardData={c}
                          owned={ownedByCard.has(c.id)}
                          badge={ownedByCard.get(c.id) || (wishlist.byCard.has(c.id) ? '♥' : undefined)}
                          badgeClass={ownedByCard.has(c.id) ? undefined : 'bg-pink-500/80 text-white'}
                          onOpen={onOpen}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
