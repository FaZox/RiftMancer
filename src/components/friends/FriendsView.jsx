import React, { useMemo, useRef, useState } from 'react';
import { Download, Upload, Users, ArrowLeft, Plus, Minus, X, Repeat } from 'lucide-react';
import EmptyState from '../common/EmptyState.jsx';
import CardImage from '../common/CardImage.jsx';
import CardPicker from '../organize/CardPicker.jsx';
import { Doubles, Trades } from '../collection/TradesView.jsx';
import { useDialog } from '../common/Dialog.jsx';
import { useBackHandler } from '../../lib/backButton.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { usePrices, unitPrice, euro } from '../../lib/prices.js';
import { saveTextFile } from '../../lib/saveText.js';
import {
  buildMyList, parseFriendList, personForList, tradeMatches, tradeGap, listFileName, listDate,
  myListId, readKeep, ownedByCard, count, itemsValue,
} from '../../lib/friendLists.js';
import { tx } from '../../lib/i18n.js';

const NAME_KEY = 'rb.friends.myName';
const readName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const SEGS = [['friends', tx('Amis')], ['trades', tx('Échanges')], ['calc', tx('Calculateur')]];
const cardsWord = (n) => `${n} carte${n > 1 ? 's' : ''}`;

/**
 * « Échanges et amis » (lot 10, B.6.7): friends' lists exchanged by file,
 * the trades they make possible, a quick trade calculator, and the history.
 */
export default function FriendsView({ scannedCards, collection, org, wishlist, defaultLanguage, onOpen, notify, wide = false }) {
  const [seg, setSeg] = useState('friends');
  const [calc, setCalc] = useState({ personId: null, given: [], received: [] });
  const [keep, setKeep] = useState(readKeep);
  const prepare = (personId, given, received) => { setCalc({ personId, given, received }); setSeg('calc'); };
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 pt-2 lg:px-8 flex-shrink-0">
        <div className="seg lg:max-w-md" role="tablist" aria-label={tx('Échanges et amis')}>
          {SEGS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={seg === id} onClick={() => setSeg(id)}>
              {label}{id === 'trades' && org.trades.items.length > 0 && <span className="font-normal text-rift-400"> {org.trades.items.length}</span>}
            </button>
          ))}
        </div>
      </div>
      {seg === 'friends' && (
        <Friends scannedCards={scannedCards} org={org} wishlist={wishlist} keep={keep} setKeep={setKeep} onOpen={onOpen} notify={notify} onPrepare={prepare} wide={wide} />
      )}
      {seg === 'trades' && (
        <div className="flex-1 overflow-y-auto pb-20"><div className="px-4 pt-3 space-y-3 lg:px-8 lg:max-w-[900px]">
          <Trades scannedCards={scannedCards} collection={collection} org={org} defaultLanguage={defaultLanguage} onOpen={onOpen} />
        </div></div>
      )}
      {seg === 'calc' && (
        <Calculator calc={calc} setCalc={setCalc} scannedCards={scannedCards} org={org} onOpen={onOpen}
          onSaved={() => { setCalc({ personId: null, given: [], received: [] }); setSeg('trades'); notify?.(tx('Échange enregistré dans l’historique'), 'success'); }} />
      )}
    </div>
  );
}

// ─── Amis ────────────────────────────────────────────────────────────────
function Friends({ scannedCards, org, wishlist, keep, setKeep, onOpen, notify, onPrepare, wide }) {
  const { inform } = useDialog();
  const fileRef = useRef(null);
  const [name, setName] = useState(readName);
  const [openId, setOpenId] = useState(null);
  const rows = useMemo(() => org.people.items.filter(p => p.list).map(p => ({ p, m: tradeMatches(p.list, scannedCards, wishlist.items, keep) }))
    .sort((a, b) => (b.p.list.at || 0) - (a.p.list.at || 0)), [org.people.items, scannedCards, wishlist.items, keep]);
  const open = rows.find(r => r.p.id === openId) || (wide ? rows[0] : null);
  useBackHandler(!wide && !!openId, () => setOpenId(null));

  const exportList = async () => {
    const n = name.trim();
    if (!n) { await inform({ title: tx('Votre nom'), message: tx('Indiquez d’abord le nom sous lequel vos amis verront votre liste.') }); return; }
    try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ }
    const list = buildMyList({ name: n, stacks: scannedCards, wishItems: wishlist.items, keep, id: myListId() });
    try {
      const where = await saveTextFile(listFileName(n), JSON.stringify(list, null, 1), 'application/json');
      notify?.(tx('Liste enregistrée ({cardsWord} en double, {cardsWord2} cherchées) : {where}', { cardsWord: cardsWord(count(list.haves)), cardsWord2: cardsWord(count(list.wants)), where }), 'success');
    } catch {
      await inform({ title: tx('Liste non enregistrée'), message: tx('Le fichier n’a pas pu être enregistré.') });
    }
  };
  const importList = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error(tx('Fichier trop grand.'));
      const list = parseFriendList(await file.text());
      const { record, created } = personForList(org.people.items, list);
      const saved = org.people.save(record);
      const m = tradeMatches(saved.list, scannedCards, wishlist.items, keep);
      setOpenId(saved.id);
      notify?.(`${created ? tx('Liste ajoutée') : tx('Liste mise à jour')} : ${saved.name} · ${cardsWord(count(m.forMe))} pour vous, ${cardsWord(count(m.forThem))} pour ${saved.name}`, 'success');
    } catch (err) {
      await inform({ title: tx('Liste non importée'), message: err.message || tx('Fichier illisible.') });
    }
  };

  const header = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => fileRef.current?.click()} className="btn-primary min-h-[44px] px-4 text-sm"><Upload className="w-4 h-4" /> {tx('Importer la liste d’un ami…')}</button>
        <button onClick={exportList} className="btn-secondary min-h-[44px] px-4 text-sm"><Download className="w-4 h-4" /> {tx('Exporter ma liste')}</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importList} />
      </div>
      <label className="flex items-center gap-2 text-[13px] text-rift-300">
        {tx('Mon nom dans la liste')}
        <input value={name} onChange={e => setName(e.target.value.slice(0, 40))} placeholder={tx('Votre prénom')}
          className="flex-1 max-w-[220px] h-9 bg-rift-800 border border-rift-600 text-[14px] text-rift-100 px-2 focus:outline-none focus:border-gold-500/60" />
      </label>
      <p className="text-[12px] text-rift-400">{tx('Votre liste contient vos doubles et vos souhaits, sans prix payés ni emplacements. Rien n’est envoyé automatiquement : déposez le fichier où vous voulez (Drive, message…).')}</p>
    </div>
  );

  if (!wide && open) {
    return (
      <div className="flex-1 overflow-y-auto pb-20"><div className="px-4 pt-3 space-y-3">
        <button onClick={() => setOpenId(null)} className="btn-ghost min-h-[40px] px-2 text-sm"><ArrowLeft className="w-4 h-4" /> {tx('Amis')}</button>
        <FriendSheet row={open} onOpen={onOpen} onPrepare={onPrepare} />
      </div></div>
    );
  }
  const list = (
    <div className="space-y-3">
      {header}
      {rows.length === 0 ? (
        <EmptyState icon={Users} text={tx('Échangez vos listes par fichier : chacun exporte ses doubles et ses souhaits.')} action={{ label: tx('Importer la liste d’un ami…'), onClick: () => fileRef.current?.click() }} />
      ) : (
        <ul className="divide-y divide-rift-600/40 border-y border-rift-600/40">
          {rows.map(({ p, m }) => (
            <li key={p.id}>
              <button onClick={() => setOpenId(p.id)} aria-current={open?.p.id === p.id}
                className={`w-full flex items-center gap-3 min-h-[64px] px-1 text-left ${open?.p.id === p.id && wide ? 'bg-rift-800' : 'hover:bg-rift-800/50'}`}>
                <span className="hexagon w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gold-500/20 font-display font-bold text-gold-400">{(p.name || '?').slice(0, 1).toUpperCase()}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-rift-100 truncate">{p.name}</span>
                  <span className="block text-[12px] text-rift-400">{listDate(p.list.at)}</span>
                </span>
                <span className="text-right text-[12px] leading-5">
                  <span className={`block ${count(m.forMe) ? 'text-state-ok' : 'text-rift-400'}`}>{cardsWord(count(m.forMe))} {tx('pour vous')}</span>
                  <span className={`block ${count(m.forThem) ? 'text-gold-400' : 'text-rift-400'}`}>{cardsWord(count(m.forThem))} {tx('pour')} {p.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <details className="panel p-3">
        <summary className="text-[13px] text-gold-400 cursor-pointer">{tx('Mes doubles · garder')} {keep} {tx('exemplaire')}{keep > 1 ? 's' : ''} {tx('par carte')}</summary>
        <div className="mt-3 space-y-3"><Doubles scannedCards={scannedCards} onOpen={onOpen} onThreshold={setKeep} /></div>
      </details>
    </div>
  );
  if (!wide) return <div className="flex-1 overflow-y-auto pb-20"><div className="px-4 pt-3">{list}</div></div>;
  return (
    <div className="flex-1 min-h-0 flex">
      <section className="w-[500px] flex-shrink-0 overflow-y-auto px-8 py-5 border-r border-rift-600/40">{list}</section>
      <section className="flex-1 min-w-0 overflow-y-auto px-8 py-5">
        {open ? <FriendSheet row={open} onOpen={onOpen} onPrepare={onPrepare} /> : <p className="text-sm text-rift-400 py-10 text-center">{tx('Les listes s’échangent par fichier. Rien n’est envoyé automatiquement.')}</p>}
      </section>
    </div>
  );
}

function CardLines({ items, prices, onOpen }) {
  const m = getMatcher();
  if (!items.length) return <p className="text-[13px] text-rift-500 py-2">{tx('Rien pour l’instant.')}</p>;
  return (
    <ul className="divide-y divide-rift-600/30">
      {items.map(i => {
        const c = m.getCardData(i.cardId);
        if (!c) return null;
        const u = unitPrice(prices, i.cardId);
        return (
          <li key={i.cardId}>
            <button onClick={() => onOpen(i.cardId)} className="w-full flex items-center gap-2.5 py-1.5 text-left">
              <span className={`flex-shrink-0 border border-rift-600/50 ${c.type === 'battlefield' ? 'w-12' : 'w-8'}`}><CardImage cardData={c} /></span>
              <span className="flex-1 min-w-0 text-[13px] text-rift-100 truncate">{getLocalizedName(c, displayLanguage())}</span>
              {i.quantity > 1 && <span className="text-[12px] text-rift-300">×{i.quantity}</span>}
              <span className="w-16 text-right font-mono text-[13px] text-rift-200">{euro(u)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FriendSheet({ row, onOpen, onPrepare }) {
  const { prices } = usePrices();
  const { p, m } = row;
  const price = (id) => unitPrice(prices, id);
  const cols = [
    [`${p.name} a, vous cherchez`, m.forMe, 'text-state-ok'],
    [tx('Vous avez en double, {name} cherche', { name: p.name }), m.forThem, 'text-gold-400'],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="hexagon w-12 h-12 flex items-center justify-center bg-gold-500/20 font-display text-xl font-bold text-gold-400">{(p.name || '?').slice(0, 1).toUpperCase()}</span>
        <div className="flex-1 min-w-[180px]">
          <h2 className="font-display text-lg font-bold text-gold-400 truncate">{p.name}</h2>
          <p className="text-[12px] text-rift-400">{listDate(p.list.at)} · {cardsWord(count(p.list.haves))} {tx('en double,')} {cardsWord(count(p.list.wants))} {tx('cherchées')}</p>
        </div>
        <button onClick={() => onPrepare(p.id, m.forThem, m.forMe)} disabled={!m.forMe.length && !m.forThem.length} className="btn-primary min-h-[44px] px-4 text-sm w-full sm:w-auto"><Repeat className="w-4 h-4" /> {tx('Préparer un échange')}</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cols.map(([title, items, tone]) => (
          <section key={title} className="panel p-4 space-y-1">
            <h3 className={`text-[14px] font-semibold ${tone}`}>{title}</h3>
            <CardLines items={items} prices={prices} onOpen={onOpen} />
            <p className="flex justify-between border-t border-rift-600/40 pt-2 text-[13px] text-rift-300">
              <span>{tx('Total ·')} {cardsWord(count(items))}</span><span className="font-mono text-rift-100">{euro(itemsValue(items, price))}</span>
            </p>
          </section>
        ))}
      </div>
      {!prices && <p className="text-[12px] text-rift-400">{tx('Prix indisponibles pour l’instant : les valeurs s’afficheront après la mise à jour des prix.')}</p>}
    </div>
  );
}

// ─── Calculateur ─────────────────────────────────────────────────────────
function Calculator({ calc, setCalc, scannedCards, org, onOpen, onSaved }) {
  const { prices } = usePrices();
  const [picker, setPicker] = useState(null);
  const m = getMatcher();
  const owned = useMemo(() => ownedByCard(scannedCards), [scannedCards]);
  const price = (id) => unitPrice(prices, id);
  const give = itemsValue(calc.given, price);
  const get = itemsValue(calc.received, price);
  const gap = tradeGap(give, get);
  const setQty = (side, cardId, q) => setCalc(c => {
    const rest = c[side].filter(i => i.cardId !== cardId);
    const cur = c[side].find(i => i.cardId === cardId);
    const item = { cardId, quantity: q };
    return { ...c, [side]: q > 0 ? (cur ? c[side].map(i => (i.cardId === cardId ? item : i)) : [...rest, item]) : rest };
  });
  const qtyOf = (side, id) => calc[side].find(i => i.cardId === id)?.quantity || 0;
  const save = () => {
    org.trades.save({ personId: calc.personId, date: Date.now(), given: calc.given, received: calc.received, applied: false, note: '' });
    onSaved();
  };
  const column = (side, title) => (
    <section className="panel p-3 space-y-2 min-w-0">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-semibold text-rift-100 mr-auto">{title}</h3>
        <button onClick={() => setPicker(side)} className="btn-ghost min-h-[36px] px-2 text-[13px]"><Plus className="w-4 h-4" /> {tx('Ajouter')}</button>
      </div>
      {calc[side].length === 0 && <p className="text-[12px] text-rift-500">{tx('Aucune carte.')}</p>}
      {calc[side].map(i => {
        const c = m.getCardData(i.cardId);
        if (!c) return null;
        return (
          <div key={i.cardId} className="flex items-center gap-2">
            <button onClick={() => onOpen(c.id)} aria-label={tx('Voir la carte')} className="w-8 flex-shrink-0 border border-rift-600/50"><CardImage cardData={c} /></button>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] text-rift-100 truncate">{getLocalizedName(c, displayLanguage())}</span>
              <span className="block text-[11px] text-rift-400">{euro(price(i.cardId))}</span>
            </span>
            <button onClick={() => setQty(side, i.cardId, i.quantity - 1)} aria-label={tx('Un de moins')} className="w-8 h-8 flex items-center justify-center bg-rift-800 text-rift-300">{i.quantity > 1 ? <Minus className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}</button>
            <span className="w-5 text-center font-mono text-[13px] text-rift-100">{i.quantity}</span>
            <button onClick={() => setQty(side, i.cardId, i.quantity + 1)} aria-label={tx('Un de plus')} className="w-8 h-8 flex items-center justify-center bg-rift-800 text-rift-300"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        );
      })}
      <p className="flex justify-between border-t border-rift-600/40 pt-2 text-[13px] text-rift-300"><span>{tx('Total')}</span><span className="font-mono font-semibold text-rift-100">{euro(side === 'given' ? give : get)}</span></p>
    </section>
  );
  const empty = !calc.given.length && !calc.received.length;
  return (
    <div className="flex-1 overflow-y-auto pb-20"><div className="px-4 pt-3 space-y-3 lg:px-8 lg:max-w-[1100px]">
      <label className="flex items-center gap-2 text-[13px] text-rift-300">
        {tx('Avec')}
        <select value={calc.personId || ''} onChange={e => setCalc(c => ({ ...c, personId: e.target.value || null }))}
          className="flex-1 max-w-[260px] h-10 bg-rift-800 border border-rift-600 text-[14px] text-rift-100 px-2">
          <option value="">{tx('Personne non précisée')}</option>
          {org.people.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <div className="grid gap-3 items-start sm:grid-cols-[1fr_auto_1fr] lg:gap-4">
        {column('given', tx('Je donne'))}
        <div className="flex items-center justify-center gap-3 sm:flex-col sm:gap-1 sm:pt-10" aria-live="polite">
          <span className={`hexagon w-[72px] h-[72px] flex flex-col items-center justify-center text-center ${gap.fair ? 'bg-state-ok/20 text-state-ok' : 'bg-state-warn/20 text-state-warn'}`}>
            <span className="font-mono text-[13px] font-semibold leading-tight">{gap.diff >= 0 ? '+' : '−'}{euro(Math.abs(gap.diff))}</span>
          </span>
          <span className={`text-[12px] text-center sm:max-w-[80px] ${gap.fair ? 'text-state-ok' : 'text-state-warn'}`}>{empty ? tx('écart') : gap.fair ? tx('équilibré') : gap.diff > 0 ? 'vous recevez plus' : 'vous donnez plus'}</span>
        </div>
        {column('received', tx('Je reçois'))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={save} disabled={empty} className="btn-primary min-h-[44px] px-5 text-sm">{tx('Enregistrer l’échange')}</button>
        {!empty && <button onClick={() => setCalc(c => ({ ...c, given: [], received: [] }))} className="btn-ghost min-h-[44px] px-4 text-sm">{tx('Tout effacer')}</button>}
      </div>
      <p className="text-[12px] text-rift-400">{tx('Prix Cardmarket du jour. Équilibré : moins de 10 % d’écart. Un échange enregistré ne touche pas à votre collection : appliquez-le depuis Échanges quand il est fait.')}</p>
      {picker && (
        <CardPicker title={picker === 'given' ? tx('Carte que je donne') : tx('Carte que je reçois')} ownedByCard={owned}
          countOf={(id) => qtyOf(picker, id)} onPick={(c) => setQty(picker, c.id, qtyOf(picker, c.id) + 1)} onClose={() => setPicker(null)} />
      )}
    </div></div>
  );
}
