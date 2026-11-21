import React, { useMemo, useState } from 'react';
import { RefreshCw, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Coins, Layers } from 'lucide-react';
import useValueData from '../../hooks/useValueData.js';
import { refreshPrices, euro, valueHistory, pct } from '../../lib/prices.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { rarityLabel } from '../../data/sampleCards.js';
import CardImage from '../../components/common/CardImage.jsx';
import { ChangeBadge } from '../../components/common/PriceHistory.jsx';
import PriceText from '../../components/common/PriceText.jsx';
import StatusPill from '../../components/common/StatusPill.jsx';
import StatsView from '../../components/collection/StatsView.jsx';
import CardZoom from '../../components/collection/CardZoom.jsx';
import MovementsPanel from '../../components/common/MovementsPanel.jsx';import { tx, locale } from '../../lib/i18n.js';


/**
 * PC value dashboard: key figures, the value over time, biggest moves, value
 * per set, and every card in a sortable table. « Statistiques » is the second tab.
 */
export default function ValuePage({ scannedCards, wishlist, onAddCopy }) {
  const [tab, setTab] = useState('value');
  const [zoom, setZoom] = useState(null);
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="flex-shrink-0 px-8 pt-7 pb-4 flex items-end gap-6 border-b border-gold-500/15">
        <h1 className="h-title text-[28px] leading-none">{tx('Valeur')}</h1>
        <div className="seg w-[320px]" role="tablist" aria-label={tx('Vues')}>
          <button role="tab" aria-selected={tab === 'value'} onClick={() => setTab('value')}>{tx('Valeur')}</button>
          <button role="tab" aria-selected={tab === 'stats'} onClick={() => setTab('stats')}>{tx('Statistiques')}</button>
        </div>
      </header>
      {tab === 'value' ? <Dashboard scannedCards={scannedCards} wishItems={wishlist.items} onOpen={setZoom} /> : <StatsView scannedCards={scannedCards} />}
      {zoom && (
        <CardZoom cardId={zoom} stacks={scannedCards} wanted={wishlist.byCard.get(zoom)?.quantity || 0}
          onSetWanted={wishlist.setWanted} onAddCopy={onAddCopy} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

function Dashboard({ scannedCards, wishItems, onOpen }) {
  const { prices, history, data } = useValueData(scannedCards);
  const [busy, setBusy] = useState(false);
  const refresh = async () => { setBusy(true); try { await refreshPrices(true); } finally { setBusy(false); } };

  if (!prices) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-rift-300">{tx('Les prix Cardmarket ne sont pas encore téléchargés (connexion Internet nécessaire).')}</p>
        <button onClick={refresh} disabled={busy} className="btn-primary h-11 px-6"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> {tx('Télécharger les prix')}</button>
      </div>
    );
  }
  const gain = data.paidCopies ? data.paidValue - data.paid : null;
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-6 max-w-[1800px]">
      <MovementsPanel scannedCards={scannedCards} wishItems={wishItems} onOpen={onOpen} />
      {/* Key figures */}
      <div className="grid grid-cols-4 gap-4">
        <Kpi icon={Coins} label={tx('Valeur de la collection')} value={euro(data.total.value)} big
          sub={`${data.total.priced} exemplaire${data.total.priced > 1 ? 's' : ''} avec un prix${data.total.unpriced ? ` · ${data.total.unpriced} sans prix` : ''}`}
          extra={data.total.estimated ? tx('dont {estimated} au prix estimé (≈)', { estimated: data.total.estimated }) : null} />
        <Kpi icon={data.week && data.week.diff < 0 ? TrendingDown : TrendingUp} label={tx('Sur 7 jours')}
          value={data.week ? `${data.week.diff >= 0 ? '+' : '−'}${euro(Math.abs(data.week.diff))}` : '—'}
          tone={data.week ? (data.week.diff >= 0 ? 'up' : 'down') : null} sub={data.week ? pct(data.week.pct) : tx('Pas encore assez d’historique')} />
        <Kpi icon={Layers} label={tx('Cartes différentes estimées')} value={String(new Set(data.all.map(r => r.cardData.id)).size)}
          sub={data.all[0] ? tx('La plus chère : {getLocalizedName} ({v1}{euro})', { getLocalizedName: getLocalizedName(data.all[0].cardData, displayLanguage()), v1: data.all[0].estimated ? '≈ ' : '', euro: euro(data.all[0].unit) }) : ''} />
        <Kpi icon={Coins} label={tx('Plus-value')} value={gain == null ? '—' : `${gain >= 0 ? '+' : '−'}${euro(Math.abs(gain))}`}
          tone={gain == null ? null : gain >= 0 ? 'up' : 'down'}
          sub={gain == null ? tx('Renseignez le prix payé (Collection → Tableau)') : tx('{paidCopies} exemplaire{v1} : payé {euro}, vaut {euro2}', { paidCopies: data.paidCopies, v1: data.paidCopies > 1 ? 's' : '', euro: euro(data.paid), euro2: euro(data.paidValue) })}
          extra={data.paidUnpriced ? tx('dont {paidUnpriced} exemplaire{v1} sans prix, non compté{v2}', { paidUnpriced: data.paidUnpriced, v1: data.paidUnpriced > 1 ? 's' : '', v2: data.paidUnpriced > 1 ? 's' : '' }) : null} />
      </div>

      {/* Value over time + per set */}
      <div className="grid grid-cols-3 gap-4 items-stretch">
        <section className="panel col-span-2 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-bold text-gold-400">{tx('Évolution de la valeur')}</h2>
            <span className="ml-auto text-sm text-rift-400">
              {tx('Prix du')} {new Date(prices.priceDate || prices.updatedAt).toLocaleDateString(locale())} · {prices.matched}/{prices.total} {tx('cartes reconnues sur Cardmarket')}
            </span>
            <button onClick={refresh} disabled={busy} className="btn-ghost h-9 px-3 text-sm"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> {tx('Mettre à jour')}</button>
          </div>
          <BigChart history={history} />
          <p className="text-xs text-rift-500">{tx('Prix tendance Cardmarket, sans distinction FR/EN ; les foils utilisent le prix foil. Un point par jour de mise à jour.')}</p>
        </section>
        <section className="panel p-5 space-y-3">
          <h2 className="font-display text-lg font-bold text-gold-400">{tx('Par extension')}</h2>
          {data.sets.map(s => (
            <div key={s.set} className="space-y-1">
              <div className="flex text-sm"><span className="text-rift-200 mr-auto">{s.name || s.set}</span><span className="font-semibold text-gold-400">{euro(s.v)}</span></div>
              <div className="h-1.5 bg-rift-700"><div className="h-full bg-gold-500" style={{ width: `${Math.max(2, (s.v / (data.total.value || 1)) * 100)}%` }} /></div>
              <p className="text-xs text-rift-500">{s.n} {tx('exemplaire')}{s.n > 1 ? 's' : ''} · {Math.round((s.v / (data.total.value || 1)) * 100)} %</p>
            </div>
          ))}
        </section>
      </div>

      {/* 7-day moves */}
      <div className="grid grid-cols-2 gap-4">
        {[[tx('Plus fortes hausses (7 jours)'), data.up, ArrowUp, 'text-state-ok'], [tx('Plus fortes baisses (7 jours)'), data.down, ArrowDown, 'text-state-bad']].map(([title, list, Icon, color]) => (
          <section key={title} className="panel p-5 space-y-2">
            <h2 className={`font-display text-lg font-bold flex items-center gap-2 ${color}`}><Icon className="w-5 h-5" /> {title}</h2>
            {list.length === 0 ? <p className="text-sm text-rift-500">{tx('Aucune pour l’instant.')}</p> : list.map(c => (
              <button key={c.key} onClick={() => onOpen(c.cardData.id)} className="w-full flex items-center gap-3 py-1.5 text-left hover:bg-rift-700/40 px-1">
                <span className={`flex-shrink-0 ${c.cardData.type === 'battlefield' ? 'w-14' : 'w-10'}`}><CardImage cardData={c.cardData} /></span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-rift-100"><span className="truncate">{getLocalizedName(c.cardData, displayLanguage())}</span>{c.foil && <StatusPill kind="foil" />}</span>
                  <span className="block text-xs text-rift-500">{c.n} {tx('exemplaire')}{c.n > 1 ? 's' : ''}</span>
                </span>
                <PriceText value={c.unit} estimated={c.estimated} className="font-mono text-sm text-rift-200 w-24 text-right" />
                <span className="w-20 text-right font-semibold text-sm"><ChangeBadge value={c.ch} /></span>
              </button>
            ))}
          </section>
        ))}
      </div>

      <AllCardsTable rows={data.all} onOpen={onOpen} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, extra, tone, big }) {
  const color = tone === 'up' ? 'text-state-ok' : tone === 'down' ? 'text-state-bad' : 'text-gold-400';
  return (
    <div className={`panel p-5 ${big ? 'hex-cut' : ''}`}>
      <p className="text-sm text-rift-400 flex items-center gap-2"><Icon className="w-4 h-4" /> {label}</p>
      <p className={`font-display font-bold mt-1 ${big ? 'text-4xl' : 'text-3xl'} ${color}`}>{value}</p>
      <p className="text-xs text-rift-500 mt-1 truncate" title={sub}>{sub}</p>
      {extra && <p className="text-xs text-rift-400 mt-0.5 truncate" title={extra}>{extra}</p>}
    </div>
  );
}

/** Value over time, drawn in real pixels (text is not stretched). */
function BigChart({ history }) {
  const pts = valueHistory(history);
  if (pts.length < 2) {
    return <div className="h-[240px] flex items-center justify-center text-sm text-rift-500 border border-dashed border-rift-600">{tx('L’historique se remplit jour après jour.')}</div>;
  }
  const vs = pts.map(p => p.v);
  const min = Math.min(...vs); const max = Math.max(...vs); const span = max - min || 1;
  const x = (i) => (i / (pts.length - 1)) * 100;
  const y = (v) => 100 - ((v - min) / span) * 100;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ');
  return (
    <div className="flex gap-3 h-[240px]">
      <div className="flex flex-col justify-between text-xs text-rift-400 text-right py-1 w-16">
        <span>{euro(max)}</span><span>{euro((min + max) / 2)}</span><span>{euro(min)}</span>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="relative flex-1 border-l border-b border-rift-600">
          {[25, 50, 75].map(t => <div key={t} className="absolute inset-x-0 border-t border-rift-700/70" style={{ top: `${t}%` }} />)}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" role="img" aria-label={tx('Évolution de la valeur de la collection')}>
            <path d={`${line} L100,100 L0,100 Z`} fill="rgba(200,168,78,0.14)" />
            <path d={line} fill="none" stroke="#c8a84e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className="flex justify-between text-xs text-rift-400 pt-1.5">
          <span>{new Date(pts[0].d).toLocaleDateString(locale())}</span>
          <span>{new Date(pts[pts.length - 1].d).toLocaleDateString(locale())}</span>
        </div>
      </div>
    </div>
  );
}

const COLS = [
  ['name', tx('Carte'), 'left'], ['set', tx('Extension'), 'left'], ['rarity', tx('Rareté'), 'left'], ['n', tx('Exemplaires'), 'right'],
  ['unit', tx('Prix unitaire'), 'right'], ['ch', '7 jours', 'right'], ['v', tx('Total'), 'right'],
];
const PAGE = 100;

/** Every owned card with a price, one line per finish; click a column to sort. */
function AllCardsTable({ rows, onOpen }) {
  const [sort, setSort] = useState({ key: 'v', dir: -1 });
  const [shown, setShown] = useState(PAGE);
  const sorted = useMemo(() => {
    const val = (r, k) => (k === 'name' ? getLocalizedName(r.cardData, displayLanguage())
      : k === 'set' ? `${r.cardData.set}${String(r.cardData.collectorNumber || '').padStart(4, '0')}`
        : k === 'rarity' ? r.cardData.rarity || '' : r[k] ?? -Infinity);
    return [...rows].sort((a, b) => {
      const A = val(a, sort.key); const B = val(b, sort.key);
      return (typeof A === 'string' ? A.localeCompare(B) : A - B) * sort.dir;
    });
  }, [rows, sort]);
  const th = 'sticky top-0 bg-rift-900 py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-rift-400 border-b border-gold-500/30 cursor-pointer select-none hover:text-rift-100';
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold text-gold-400">{tx('Toutes les cartes')} <span className="font-body text-sm font-normal text-rift-400">· {rows.length}</span></h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className={`${th} w-14`} />
            {COLS.map(([k, l, align]) => (
              <th key={k} className={`${th} text-${align}`} aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}
                onClick={() => setSort(s => ({ key: k, dir: s.key === k ? -s.dir : (k === 'name' || k === 'set' ? 1 : -1) }))}>
                {l}{sort.key === k && (sort.dir > 0 ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, shown).map(r => {
            const d = r.cardData;
            const td = 'py-2 px-3 border-b border-rift-700/70';
            return (
              <tr key={r.key} onClick={() => onOpen(d.id)} className="cursor-pointer hover:bg-rift-800/60">
                <td className={td}><span className={`block ${d.type === 'battlefield' ? 'w-14' : 'w-9'}`}><CardImage cardData={d} /></span></td>
                <td className={`${td} font-semibold text-rift-100`}>
                  <span className="inline-flex items-center gap-2">{getLocalizedName(d, displayLanguage())}{r.foil && <StatusPill kind="foil" />}{r.promo && <span className="text-xs font-normal text-rift-400">{tx('Promo')}</span>}</span>
                </td>
                <td className={`${td} text-rift-300 whitespace-nowrap`}>{d.setName || d.set} <span className="font-mono text-rift-500">#{d.collectorNumber}</span></td>
                <td className={`${td} text-rift-300`}>{rarityLabel(d.rarity)}</td>
                <td className={`${td} text-right text-rift-200`}>{r.n}</td>
                <td className={`${td} text-right`}><PriceText value={r.unit} estimated={r.estimated} className="font-mono text-rift-200" /></td>
                <td className={`${td} text-right`}><ChangeBadge value={r.ch} /></td>
                <td className={`${td} text-right font-semibold text-gold-400`}>{euro(r.v)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length > shown && (
        <div className="text-center"><button onClick={() => setShown(n => n + PAGE)} className="btn-secondary px-6 text-sm">{tx('Afficher plus (')}{sorted.length - shown} {tx('restantes)')}</button></div>
      )}
    </section>
  );
}
