// « Valeur »: collection value, history, rises and falls.
import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { euro, refreshPrices, valueHistory } from '../../lib/prices.js';
import { isNative } from '../../lib/nativeAssets.js';
import { ChangeBadge } from '../common/PriceHistory.jsx';
import PriceChart from '../common/PriceChart.jsx';
import { isDesktop } from '../../lib/collectionDB.js';
import CardTile from './CardTile.jsx';
import CardImage from '../common/CardImage.jsx';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import useValueData from '../../hooks/useValueData.js';
import { useDialog } from '../common/Dialog.jsx';
import PriceText from '../common/PriceText.jsx';
import StatusPill from '../common/StatusPill.jsx';
import MovementsPanel from '../common/MovementsPanel.jsx';import { tx, locale } from '../../lib/i18n.js';


// ─── Value (Cardmarket trend prices) ─────────────────────────────────────
/** Collection value over 1, 3, 6 months or all of it (PriceChart). */
export function ValueChart({ history, height = 'h-28' }) {
  return (
    <PriceChart points={valueHistory(history)} height={height} label={tx('Valeur de la collection')} showChange={false}
      empty={tx('L’historique se remplit jour après jour (un point par jour où les prix sont mis à jour).')} />
  );
}

export function ValueView({ scannedCards, onOpen, wishItems = [] }) {
  // Value computation shared with the PC page
  const { prices, history, data } = useValueData(scannedCards);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(48); // cards list: shown in pages (thousands of cards)
  const { inform } = useDialog();

  const refresh = async () => {
    setBusy(true);
    try {
      const ok = await refreshPrices(true);
      if (!ok && !isDesktop) await inform({ title: tx('Prix non mis à jour'), message: tx('Impossible de télécharger les prix Cardmarket. Vérifiez la connexion Internet.') });
    } finally { setBusy(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 pt-3 pb-4 space-y-4 lg:px-8 lg:max-w-[1800px]">
        {!prices ? (
          <p className="text-xs text-rift-400 py-8 text-center">
            {isDesktop || isNative
              ? tx('Téléchargement des prix Cardmarket… (connexion Internet nécessaire)')
              : tx('Les prix viennent de l’app PC ou du téléphone.')}
            {isNative && (
              <button onClick={refresh} disabled={busy} className="btn-ghost text-xs py-1.5 px-3 mt-3 mx-auto">
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> {tx('Télécharger les prix')}
              </button>
            )}
          </p>
        ) : (
          <>
            {/* Lot 9: your alerts first, only when there is something */}
            <MovementsPanel scannedCards={scannedCards} wishItems={wishItems} onOpen={onOpen} />
            {/* PC: value and 7-day changes side by side */}
            <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
            <div className="panel hex-cut p-4 space-y-1" data-help="value.total">
              <p className="text-xs text-rift-400">{tx('Valeur de la collection (Cardmarket, prix tendance)')}</p>
              <p className="text-3xl font-display font-bold text-gold-400">{euro(data.total.value)}</p>
              <p className="text-[11px] text-rift-500">
                {data.total.priced} {tx('exemplaire')}{data.total.priced > 1 ? 's' : ''} {tx('avec un prix')}
                {data.total.unpriced > 0 && ` · ${data.total.unpriced} sans prix`}
                {data.total.estimated > 0 && tx(' · dont {estimated} au prix estimé (≈)', { estimated: data.total.estimated })}
                {' · '}{tx('prix du')} {new Date(prices.priceDate || prices.updatedAt).toLocaleDateString(locale())}
                {' · '}{prices.matched}/{prices.total} {tx('cartes reconnues sur Cardmarket')}
              </p>
              <p className="text-[11px] text-rift-500">{tx('Pas de distinction FR/EN ; les foils utilisent le prix foil (≈ estimé quand Cardmarket n’en a pas).')}</p>
              <div className="pt-2"><ValueChart history={history} /></div>
              {(isDesktop || isNative) && (
                <button onClick={refresh} disabled={busy} className="btn-ghost text-xs py-1.5 px-3 mt-1">
                  <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> {tx('Mettre à jour les prix')}
                </button>
              )}
            </div>

            {/* 1. Variations over 7 days, with small card pictures */}
            {(data.up.length > 0 || data.down.length > 0) && (
              <section className="panel p-4 space-y-2">
                <h3 className="font-display text-[15px] font-bold text-gold-400">{tx('Variations sur 7 jours')}</h3>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
                  {[['Hausses', data.up], ['Baisses', data.down]].map(([title, list]) => (
                    <div key={title} className="space-y-1">
                      <p className="text-xs text-rift-400">{title}</p>
                      {list.length === 0 && <p className="text-xs text-rift-500">—</p>}
                      {list.map(c => (
                        <button key={c.key} onClick={() => onOpen(c.cardData.id)} className="w-full flex items-center text-[13px] text-rift-200 gap-2.5 py-1 hover:text-rift-100 text-left">
                          <span className={`flex-shrink-0 border border-rift-600/50 ${c.cardData.type === 'battlefield' ? 'w-12' : 'w-8'}`}><CardImage cardData={c.cardData} /></span>
                          <span className="mr-auto truncate">{getLocalizedName(c.cardData, displayLanguage())}</span>
                          {c.foil && <StatusPill kind="foil" />}
                          <PriceText value={c.unit} estimated={c.estimated} className="font-mono text-rift-300" />
                          <span className="w-12 text-right font-semibold"><ChangeBadge value={c.ch} /></span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            </div>

            {/* 2. Every card, most valuable first */}
            {data.all.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-display text-[15px] font-bold text-gold-400">{tx('Toutes les cartes')} <span className="font-body text-xs font-normal text-rift-400">· {data.all.length} {tx('· de la plus chère à la moins chère')}</span></h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                  {data.all.slice(0, shown).map(t => (
                    <CardTile key={t.key} cardData={t.cardData} badge={`${t.estimated ? '≈ ' : ''}${euro(t.v)}`} badgeClass={t.estimated ? 'bg-state-warn text-rift-900' : 'bg-gold-500 text-rift-900'} onOpen={onOpen}
                      pills={[t.foil && { kind: 'foil' }, t.promo && { kind: 'promo' }].filter(Boolean)} />
                  ))}
                </div>
                {data.all.length > shown && (
                  <button onClick={() => setShown(n => n + 96)} className="btn-secondary w-full text-sm">
                    {tx('Afficher plus (')}{data.all.length - shown} {tx('restantes)')}
                  </button>
                )}
              </section>
            )}

            {data.sets.length > 1 && (
              <section className="panel p-4 space-y-1">
                <h3 className="font-display text-[15px] font-bold text-gold-400">{tx('Par extension')}</h3>
                {data.sets.map(s => (
                  <p key={s.set} className="flex text-[13px] text-rift-300"><span className="mr-auto">{s.name} ({s.set})</span><span className="font-mono text-rift-100">{euro(s.v)}</span></p>
                ))}
              </section>
            )}

            {/* 3. Gain / loss on the copies with a purchase price — at the bottom */}
            <section className="panel p-4 space-y-1">
              <h3 className="font-display text-[15px] font-bold text-gold-400">{tx('Plus-value')}</h3>
              {data.paidCopies > 0 ? (
                <p className="text-[13px] text-rift-300">
                  {data.paidCopies} {tx('exemplaire')}{data.paidCopies > 1 ? 's' : ''} {tx('avec un prix d’achat : payé')} {euro(data.paid)}{tx(', valeur actuelle')} {euro(data.paidValue)} →{' '}
                  <strong className={data.paidValue - data.paid >= 0 ? 'text-state-ok' : 'text-state-bad'}>{data.paidValue - data.paid >= 0 ? '+' : ''}{euro(data.paidValue - data.paid)}</strong>
                </p>
              ) : (
                <p className="text-[13px] text-rift-400">{tx('Aucun prix d’achat renseigné.')}</p>
              )}
              {data.paidUnpriced > 0 && (
                <p className="text-[13px] text-rift-400">{tx('dont')} {data.paidUnpriced} {tx('exemplaire')}{data.paidUnpriced > 1 ? 's' : ''} {tx('sans prix, non compté')}{data.paidUnpriced > 1 ? 's' : ''}</p>
              )}
              <p className="text-[11px] text-rift-500">{tx('Renseignez le prix payé dans Collection → vue Liste (champ « Payé » de chaque ligne).')}</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
