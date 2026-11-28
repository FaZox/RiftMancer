import React, { useMemo, useRef, useState } from 'react';
import { Copy, Check, Plus, Minus, Trash2, ArrowLeft, Repeat, CheckCircle } from 'lucide-react';
import CardTile from './CardTile.jsx';
import CardImage from '../common/CardImage.jsx';
import CardPicker from '../organize/CardPicker.jsx';
import { copyText } from '../organize/DeckDialogs.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { compareCollector } from '../../lib/catalog.js';
import { usePrices, unitPrice, euro } from '../../lib/prices.js';

import { useBackHandler } from '../../lib/backButton.js';
import { useDialog } from '../common/Dialog.jsx';
import { offerUndo } from '../../lib/undo.js';
import { tx, locale } from '../../lib/i18n.js';
const TRADE_KEY = 'riftbound_trade_threshold';
const selectClass = 'h-8 bg-rift-800 border border-rift-600/40 rounded-lg text-xs text-rift-200 px-2 focus:outline-none focus:border-gold-500/60';
const inputClass = 'w-full h-9 bg-rift-800 border border-rift-600/40 rounded-lg text-sm text-rift-100 px-2 focus:outline-none focus:border-gold-500/60';

function readThreshold() {
  try { return Number(localStorage.getItem(TRADE_KEY)) || 3; } catch { return 3; }
}

const itemsValue = (prices, items) => items.reduce((v, i) => v + (unitPrice(prices, i.cardId) || 0) * i.quantity, 0);

/** Tradeable doubles (shareable as text) + record of trades with people. */
export default function TradesView({ scannedCards, collection, org, defaultLanguage, onOpen }) {
  const [tab, setTab] = useState('doubles');
  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 pt-3 pb-4 space-y-3 lg:px-8 lg:max-w-[1800px]">
        <div className="flex gap-1.5">
          {[['doubles', tx('Mes doubles')], ['trades', tx('Échanges ({length})', { length: org.trades.items.length })]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-3 py-1 rounded-lg text-xs border ${tab === v ? 'bg-gold-400/20 text-gold-400 border-gold-400/30' : 'text-rift-400 border-rift-600/30'}`}>{l}</button>
          ))}
        </div>
        {tab === 'doubles'
          ? <Doubles scannedCards={scannedCards} onOpen={onOpen} />
          : <Trades scannedCards={scannedCards} collection={collection} org={org} defaultLanguage={defaultLanguage} onOpen={onOpen} />}
      </div>
    </div>
  );
}

// ─── Doubles ─────────────────────────────────────────────────────────────
export function Doubles({ scannedCards, onOpen, onThreshold }) {
  const { prices } = usePrices();
  const [threshold, setThreshold] = useState(readThreshold);
  const [lang, setLang] = useState('French');
  const [copied, setCopied] = useState(false);
  const area = useRef(null);
  const update = (v) => {
    setThreshold(v);
    onThreshold?.(v);
    try { localStorage.setItem(TRADE_KEY, String(v)); } catch { /* ignore */ }
  };

  const rows = useMemo(() => {
    const byCard = new Map();
    for (const s of scannedCards) {
      const r = byCard.get(s.cardData.id) || { cardData: s.cardData, total: 0 };
      r.total += s.quantity;
      byCard.set(s.cardData.id, r);
    }
    return [...byCard.values()]
      .filter(r => r.total > threshold)
      .sort((a, b) => compareCollector(a.cardData, b.cardData));
  }, [scannedCards, threshold]);
  const extra = rows.reduce((n, r) => n + r.total - threshold, 0);

  const text = useMemo(() => {
    const fr = lang === 'French';
    const lines = rows.map(r => {
      const p = prices ? unitPrice(prices, r.cardData.id) : null;
      return `${r.total - threshold}x ${getLocalizedName(r.cardData, lang)} (${r.cardData.set} ${r.cardData.collectorNumber})${p != null ? ` · ${euro(p)}` : ''}`;
    });
    return [fr ? tx('Mes doubles Riftbound ({extra} cartes) :', { extra }) : tx('My Riftbound trades ({extra} cards):', { extra }), ...lines].join('\n');
  }, [rows, lang, prices, threshold, extra]);

  const copy = async () => {
    if (await copyText(text, area.current)) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-rift-300 flex-wrap">
        <span>{tx('Garder')}</span>
        <select value={threshold} onChange={e => update(Number(e.target.value))} className={selectClass}>
          {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>{tx('exemplaire')}{threshold > 1 ? 's' : ''} {tx('par carte, le reste est échangeable.')}</span>
      </div>
      <p className="text-xs text-rift-400">
        {rows.length === 0 ? tx('Aucun doublon au-delà de ce seuil.') : tx('{extra} exemplaire{v1} échangeable{v2} sur {length} carte{v4}.', { extra, v1: extra > 1 ? 's' : '', v2: extra > 1 ? 's' : '', length: rows.length, v4: rows.length > 1 ? 's' : '' })}
      </p>
      {rows.length > 0 && (
        <details className="rounded-xl bg-rift-800/60 border border-rift-600/20 p-3">
          <summary className="text-xs text-gold-400 cursor-pointer">{tx('Partager la liste (texte à coller dans un message)')}</summary>
          <div className="mt-2 space-y-2">
            <div className="flex gap-1.5">
              {[['French', tx('Français')], ['English', tx('Anglais')]].map(([v, l]) => (
                <button key={v} onClick={() => setLang(v)}
                  className={`flex-1 py-1 rounded-lg text-xs border ${lang === v ? 'bg-gold-400/20 text-gold-400 border-gold-400/30' : 'text-rift-400 border-rift-600/30'}`}>{l}</button>
              ))}
            </div>
            <textarea ref={area} readOnly value={text} rows={6} className="w-full bg-rift-900/70 border border-rift-600/40 rounded-xl text-xs font-mono text-rift-100 p-2" />
            <button onClick={copy} className="btn-primary w-full text-sm py-2 rounded-xl">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? tx('Copié') : tx('Copier la liste')}
            </button>
          </div>
        </details>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {rows.map(r => (
          <CardTile key={r.cardData.id} cardData={r.cardData} badge={`+${r.total - threshold}`} badgeClass="bg-green-500 text-rift-900" onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

// ─── Trades ──────────────────────────────────────────────────────────────
export function Trades({ scannedCards, collection, org, defaultLanguage, onOpen }) {
  const { trades, people } = org;
  const { prices } = usePrices();
  const [openId, setOpenId] = useState(null);
  const open = openId && trades.byId.get(openId);
  const list = [...trades.items].sort((a, b) => (b.date || 0) - (a.date || 0));

  if (open) {
    return <TradeEditor trade={open} scannedCards={scannedCards} collection={collection} org={org}
      defaultLanguage={defaultLanguage} onOpen={onOpen} onBack={() => setOpenId(null)} />;
  }

  const create = () => {
    const t = trades.save({ personId: people.items[0]?.id || null, date: Date.now(), given: [], received: [], applied: false, note: '' });
    setOpenId(t.id);
  };

  return (
    <>
      <button onClick={create} className="btn-primary w-full text-sm py-2.5 rounded-xl"><Plus className="w-4 h-4" /> {tx('Nouvel échange')}</button>
      {list.length === 0 && <p className="text-xs text-rift-500 text-center py-6">{tx('Aucun échange enregistré. Notez ce que vous donnez et recevez : l’app calcule la différence de valeur et met votre collection à jour.')}</p>}
      {list.map(t => {
        const g = t.applied ? t.valueGiven ?? 0 : itemsValue(prices, t.given || []);
        const r = t.applied ? t.valueReceived ?? 0 : itemsValue(prices, t.received || []);
        const n = (x) => (x || []).reduce((k, i) => k + i.quantity, 0);
        return (
          <button key={t.id} onClick={() => setOpenId(t.id)} className="w-full text-left rounded-xl bg-rift-800/60 border border-rift-600/20 p-3 hover:border-gold-400/40 space-y-0.5">
            <p className="text-sm text-rift-100 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-gold-400" />
              <span className="mr-auto">{people.byId.get(t.personId)?.name || tx('Sans nom')} · {new Date(t.date).toLocaleDateString(locale())}</span>
              {t.applied && <CheckCircle className="w-4 h-4 text-green-400" title={tx('Appliqué à la collection')} />}
            </p>
            <p className="text-[11px] text-rift-400">
              {tx('Donné')} {n(t.given)} ({euro(g)}{tx(') · reçu')} {n(t.received)} ({euro(r)}) ·{' '}
              <span className={r - g >= 0 ? 'text-green-400' : 'text-red-400'}>{r - g >= 0 ? '+' : ''}{euro(r - g)}</span>
            </p>
          </button>
        );
      })}
    </>
  );
}

function TradeEditor({ trade, scannedCards, collection, org, defaultLanguage, onOpen, onBack }) {
  const { ask } = useDialog();
  useBackHandler(true, onBack);
  const { trades, people } = org;
  const { prices } = usePrices();
  const m = getMatcher();
  const [picker, setPicker] = useState(null); // 'given' | 'received'
  const [newName, setNewName] = useState('');
  const save = (patch) => trades.save({ ...trade, ...patch });
  const ownedByCard = useMemo(() => {
    const map = new Map();
    for (const s of scannedCards) map.set(s.cardData.id, (map.get(s.cardData.id) || 0) + s.quantity);
    return map;
  }, [scannedCards]);

  const g = itemsValue(prices, trade.given || []);
  const r = itemsValue(prices, trade.received || []);

  const setQty = (side, cardId, q) => {
    const rest = (trade[side] || []).filter(i => i.cardId !== cardId);
    save({ [side]: q > 0 ? [...rest, { cardId, quantity: q }] : rest });
  };
  const add = (side, c) => {
    const cur = (trade[side] || []).find(i => i.cardId === c.id)?.quantity || 0;
    setQty(side, c.id, cur + 1);
  };

  const apply = async () => {
    // Given cards: free copies of that card (not in a deck, not lent) are removed.
    const toDelete = [];
    const short = [];
    for (const it of trade.given || []) {
      const free = collection.copies.filter(c => c.cardId === it.cardId && !c.deckId && !c.loanId && !toDelete.includes(c.id));
      toDelete.push(...free.slice(0, it.quantity).map(c => c.id));
      if (free.length < it.quantity) short.push(getLocalizedName(m.getCardData(it.cardId), displayLanguage()));
    }
    const msg = tx('Retirer {length} exemplaire(s) donné(s) et ajouter {reduce} exemplaire(s) reçu(s).', { length: toDelete.length, reduce: (trade.received || []).reduce((n, i) => n + i.quantity, 0) })
      + (short.length ? tx('\n\nPas assez d’exemplaires libres pour : {join} (seuls les exemplaires libres sont retirés).', { join: short.join(', ') }) : '');
    if (!(await ask({ title: tx('Mettre la collection à jour ?'), message: msg, confirmLabel: tx('Mettre à jour') }))) return;
    collection.deleteCopies(toDelete);
    collection.addEntries((trade.received || []).map(i => ({
      cardId: i.cardId, quantity: i.quantity, language: defaultLanguage || 'French', condition: 'Near Mint', foil: false, source: 'trade',
    })));
    save({ applied: true, valueGiven: Math.round(g * 100) / 100, valueReceived: Math.round(r * 100) / 100 });
  };

  const remove = () => {
    // la collection n'est pas modifiée : supprimé tout de suite, « Annuler » quelques secondes
    trades.remove(trade.id);
    offerUndo({ message: tx('Échange retiré de l’historique'), run: () => trades.save(trade) });
    onBack();
  };

  const side = (key, title) => (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-rift-300 uppercase tracking-wider mr-auto">{title} · {euro(itemsValue(prices, trade[key] || []))}</h3>
        {!trade.applied && <button onClick={() => setPicker(key)} className="btn-ghost text-xs py-1 px-2 rounded-lg"><Plus className="w-3.5 h-3.5" /> {tx('Ajouter')}</button>}
      </div>
      {(trade[key] || []).length === 0 && <p className="text-[11px] text-rift-500">{tx('Aucune carte.')}</p>}
      {(trade[key] || []).map(i => {
        const c = m.getCardData(i.cardId);
        if (!c) return null;
        return (
          <div key={i.cardId} className="flex items-center gap-2 rounded-xl bg-rift-700/40 p-1.5">
            <button onClick={() => onOpen(c.id)} aria-label={tx('Voir la carte')} className="w-10 flex-shrink-0 border border-rift-600/50 bg-rift-800"><CardImage cardData={c} /></button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-rift-100 truncate">{getLocalizedName(c, displayLanguage())}</p>
              <p className="text-[11px] text-rift-400">{c.set} #{c.collectorNumber} · {euro(unitPrice(prices, i.cardId))}{key === 'given' && ` · vous en avez ${ownedByCard.get(i.cardId) || 0}`}</p>
            </div>
            {!trade.applied && (
              <div className="flex items-center gap-0.5">
                <button onClick={() => setQty(key, i.cardId, i.quantity - 1)} className="w-7 h-7 rounded-lg bg-rift-800 flex items-center justify-center text-rift-300"><Minus className="w-3 h-3" /></button>
                <span className="w-6 text-center text-sm font-mono text-rift-100">{i.quantity}</span>
                <button onClick={() => setQty(key, i.cardId, i.quantity + 1)} className="w-7 h-7 rounded-lg bg-rift-800 flex items-center justify-center text-rift-300"><Plus className="w-3 h-3" /></button>
              </div>
            )}
            {trade.applied && <span className="text-sm font-mono text-rift-200 px-2">×{i.quantity}</span>}
          </div>
        );
      })}
    </section>
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-lg text-rift-300 hover:bg-rift-700" aria-label={tx('Retour')}><ArrowLeft className="w-5 h-5" /></button>
        <span className="flex-1 text-sm font-semibold text-rift-100">{tx('Échange du')} {new Date(trade.date).toLocaleDateString(locale())}</span>
        <button aria-label={tx('Supprimer l’échange')} onClick={remove} className="p-2 rounded-lg text-red-400 hover:bg-red-400/10" title={tx('Supprimer l’échange')}><Trash2 className="w-5 h-5" /></button>
      </div>

      <div className="space-y-1.5">
        <select value={trade.personId || '__new'} onChange={e => save({ personId: e.target.value === '__new' ? null : e.target.value })} className={inputClass}>
          {people.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="__new">{tx('+ Nouvelle personne…')}</option>
        </select>
        {!trade.personId && (
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={tx('Nom de la personne')} className={inputClass} />
            <button disabled={!newName.trim()} onClick={() => { const p = people.save({ name: newName.trim(), note: '' }); save({ personId: p.id }); setNewName(''); }} className="btn-secondary text-xs px-3 rounded-lg">{tx('OK')}</button>
          </div>
        )}
      </div>

      {side('given', tx('Je donne'))}
      {side('received', tx('Je reçois'))}

      <div className={`rounded-xl p-3 border text-sm ${r - g >= 0 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
        {tx('Différence (prix Cardmarket) :')} <strong className={r - g >= 0 ? 'text-green-400' : 'text-red-400'}>{r - g >= 0 ? '+' : ''}{euro(r - g)}</strong>
        <span className="block text-[11px] text-rift-400">{r - g >= 0 ? tx('Vous recevez plus que vous ne donnez.') : tx('Vous donnez plus que vous ne recevez.')}{!prices && ' (prix indisponibles : synchronisez avec le PC)'}</span>
      </div>

      <textarea value={trade.note || ''} onChange={e => save({ note: e.target.value })} rows={2} placeholder={tx('Notes')}
        className="w-full bg-rift-800/50 border border-rift-600/30 rounded-xl text-xs text-rift-100 p-2 focus:outline-none focus:border-gold-500/60" />

      {trade.applied
        ? <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {tx('Appliqué à la collection (valeurs figées au moment de l’échange).')}</p>
        : <button onClick={apply} disabled={!(trade.given || []).length && !(trade.received || []).length} className="btn-primary w-full text-sm py-2.5 rounded-xl">{tx('Appliquer à ma collection')}</button>}

      {picker && (
        <CardPicker
          title={picker === 'given' ? tx('Carte que je donne') : tx('Carte que je reçois')}
          ownedByCard={ownedByCard}
          countOf={(id) => (trade[picker] || []).find(i => i.cardId === id)?.quantity || 0}
          onPick={(c) => add(picker, c)}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}
