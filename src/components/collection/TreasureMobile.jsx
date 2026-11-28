import React, { useMemo } from 'react';

import { Heart } from 'lucide-react';

import HexPortal from '../common/HexPortal.jsx';

import SearchButton from '../common/SearchButton.jsx';

import CardTileMobile from '../cards/CardTileMobile.jsx';

import { useDialog } from '../common/Dialog.jsx';

import { ProgressRing, Sparkline } from './CollectionParts.jsx';

import { allCards, isBaseCard } from '../../lib/catalog.js';

import { compareCollector } from '../../lib/catalogOrder.js';

import { setProgress, masterpiece, collectionSummary, recentAdds, setArt, localDay } from '../../lib/collectionStats.js';

import { usePrices, valueHistory, unitPrice, priceRef, euro, stacksValue } from '../../lib/prices.js';

import { displayName } from '../../lib/cardLocale.js';

import { setImage } from '../../lib/setImages.js';

import { thumbSrc } from '../../lib/nativeAssets.js';

import { requestOpen } from '../../lib/navRequest.js';

import { tx, locale, tp } from '../../lib/i18n.js';

const nf = (n) => Math.round(n).toLocaleString(locale());

/**
 * « Salle du trésor » téléphone (maquette mobile-reference.html écran 1) : en-tête
 * Collection + ♥ souhaits + recherche, héros (pièce maîtresse 128 px + total),
 * 4 médaillons hexagonaux, les portails des extensions en défilement horizontal,
 * la courbe de valeur 30 j, puis les étagères (derniers ajouts sans badge, une
 * étagère par extension avec « Voir tout »).
 */
export default function TreasureMobile({ scannedCards, ownedByCard, copies, wishlist, onOpen, onOpenSet, onOpenJournal }) {
  const { ask } = useDialog();
  const { prices, history } = usePrices();
  const catalog = useMemo(() => allCards(), []);
  const progress = useMemo(() => setProgress(ownedByCard, catalog), [ownedByCard, catalog]);
  const priceFor = (cd, s) => (prices ? unitPrice(prices, cd.id, !!s?.foil, priceRef(), !!s?.promo) : null);
  const master = useMemo(() => masterpiece(scannedCards, priceFor), [scannedCards, prices]); // eslint-disable-line react-hooks/exhaustive-deps
  const masterPrice = master && prices ? unitPrice(prices, master.id, false) ?? unitPrice(prices, master.id, true) : null;
  const pts = useMemo(() => valueHistory(history).slice(-30), [history]);
  const value = useMemo(() => (prices ? stacksValue(prices, scannedCards).value : 0), [prices, scannedCards]);
  const summary = useMemo(() => collectionSummary(scannedCards, {
    catalogSize: catalog.length, value, copies,
    valueAt: pts.length ? (t) => { const day = localDay(t); let v = null; for (const p of pts) if (p.d <= day) v = p.v; return v; } : null,
  }), [scannedCards, catalog, value, copies, pts]);
  const nSets = progress.filter(s => s.owned > 0).length;
  const byId = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog]);

  const recentIds = useMemo(() => {
    const seen = new Set(); const out = [];
    for (const d of recentAdds(copies, { days: 30 })) for (const c of d.cards) if (!seen.has(c.cardId) && byId.has(c.cardId)) { seen.add(c.cardId); out.push(c.cardId); }
    return out.slice(0, 40);
  }, [copies, byId]);

  const missingToWish = async () => {
    const toAdd = catalog.filter(c => isBaseCard(c) && !ownedByCard.has(c.id) && !wishlist.byCard.has(c.id));
    if (!toAdd.length) return;
    if (await ask({ title: tx('Ajouter aux souhaits ?'), message: tx('{n} carte(s) manquante(s) ajoutée(s) à la liste de souhaits.', { n: toAdd.length }), confirmLabel: tx('Ajouter') })) toAdd.forEach(c => wishlist.setWanted(c.id, 1));
  };

  const shelfOf = (code) => catalog.filter(c => c.set === code && ownedByCard.has(c.id)).sort(compareCollector);
  const delta = pts.length > 1 ? pts.at(-1).v - pts[0].v : null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-6">
      <div className="mh">
        <h2>{tx('Collection')}</h2>
        <button type="button" className="ib wish" data-help="collection.wish"
          onClick={() => requestOpen({ kind: 'more', id: 'wishlist' })} aria-label={tx('Souhaits')}>
          <Heart size={18} fill="currentColor" aria-hidden="true" /> <b>{wishlist.items.length}</b>
        </button>
        <SearchButton />
      </div>

      {/* Héros : pièce maîtresse + total */}
      <div className="mhero" data-help="collection.hero">
        <div className="spot" data-cardid={master?.id}>
          {master && (
            <>
              <div className="rf-holo rf-holo-on">
                <button type="button" onClick={() => onOpen(master.id, { list: [master.id] })} aria-label={displayName(master)} className="block w-full">
                  <span className="mcard block w-full"><img src={thumbSrc(master.id)} alt="" draggable={false} /></span>
                </button>
              </div>
              <span className="rib">★ {tx('Pièce maîtresse')}{masterPrice != null ? ` · ${euro(masterPrice)}` : ''}</span>
            </>
          )}
        </div>
        <div className="min-w-0">
          <div className="eb">{tx('Ta collection')}</div>
          <h3>{tp(summary.total, '{n} carte', '{n} cartes', { n: nf(summary.total) })}</h3>
          <p>
            {tp(nSets, '{n} extension', '{n} extensions', { n: nSets })} · +{summary.addedWeek} {tx('cette semaine')}
            {summary.valueSinceMonday != null && summary.valueSinceMonday !== 0 && (
              <> · {tx('valeur')} <b className={summary.valueSinceMonday > 0 ? '!text-[var(--ok)]' : '!text-state-bad'}>
                {summary.valueSinceMonday > 0 ? '+' : '−'}{euro(Math.abs(summary.valueSinceMonday))}
              </b></>
            )}
          </p>
        </div>
      </div>

      {/* 4 médaillons */}
      <div className="medals4">
        <div className="medal4"><div><b>{nf(summary.total)}</b><small>{tx('Cartes')}</small></div></div>
        <div className="medal4"><div><b>{nf(summary.different)}</b><small>{tx('Différentes')}</small></div></div>
        <div className="medal4 ok"><div><b>{prices ? euro(summary.value) : '—'}</b><small>{tx('Valeur')}</small></div></div>
        <div className="medal4"><div><b>{Math.round(summary.pct * 100)}%</b><small>{tx('Complète')}</small></div></div>
      </div>

      {/* Portails des extensions */}
      <div className="sect" data-help="collection.portals">
        <h4>{tx('Extensions')}<small>{tx('touche un portail pour l’ouvrir')}</small></h4>
        <button type="button" className="link inline-flex items-center gap-1" onClick={missingToWish}>
          <Heart size={12} aria-hidden="true" /> {tx('Manquantes → souhaits')}
        </button>
      </div>
      <div className="hscroll">
        {progress.map(s => (
          <div key={s.code} className="mp">
            <div className="hx">
              <HexPortal pct={s.pct} art={setArt(s.code, catalog)?.id} size={66} complete={s.pct >= 1} onClick={() => onOpenSet(s.code)}
                title={tx('{name} : {owned} / {total}', { name: s.name, owned: s.owned, total: s.total })}>
                <b className="pct text-rift-100">{Math.round(s.pct * 100)}%</b>
              </HexPortal>
            </div>
            <b>{s.name}</b>
            <small>{s.owned}/{s.total}</small>
          </div>
        ))}
      </div>

      {/* Courbe de valeur 30 j */}
      {pts.length > 1 && delta != null && (
        <div className="spark">
          <div>
            <small>{tx('Valeur')} · 30 {tx('j')}</small>
            <b>{delta >= 0 ? '+' : '−'}{euro(Math.abs(delta))}</b>
          </div>
          <Sparkline points={pts} width={240} height={36} />
        </div>
      )}

      {/* Étagères */}
      {recentIds.length > 0 && (
        <section aria-label={tx('Derniers ajouts')}>
          <div className="sect" data-help="collection.shelves">
            <h4>{tx('Derniers ajouts')}<small>{tx('{n} cette semaine', { n: summary.addedWeek })}</small></h4>
            <button type="button" className="vtall" onClick={onOpenJournal}>{tx('Voir tout')} →</button>
          </div>
          <div className="hscroll shelfrow">
            {recentIds.map(id => (
              <CardTileMobile key={id} card={byId.get(id)} name={displayName(byId.get(id))} width={96} label={false}
                onOpen={(cid) => onOpen(cid, { list: recentIds })} />
            ))}
          </div>
        </section>
      )}
      {progress.filter(s => s.owned > 0).map(s => {
        const list = shelfOf(s.code);
        const ids = list.map(c => c.id);
        const pack = setImage(s.code);
        return (
          <section key={s.code} aria-label={s.name}>
            <div className="sect">
              <ProgressRing pct={s.pct} size={44} />
              {pack && <img className="packm" src={pack} alt="" aria-hidden="true" />}
              <h4>{s.name}<small>{s.owned} / {s.total}</small></h4>
              <button type="button" className="vtall" onClick={() => onOpenSet(s.code)}>{tx('Voir tout')} →</button>
            </div>
            <div className="hscroll shelfrow">
              {list.slice(0, 40).map(c => (
                <CardTileMobile key={c.id} card={c} name={displayName(c)} width={96} owned={ownedByCard.get(c.id)} label={false}
                  onOpen={(cid) => onOpen(cid, { list: ids })} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
