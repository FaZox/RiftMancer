import React, { useEffect, useState } from 'react';
import { Download, Trash2, Loader2, LayoutGrid, Square, Pencil, Plus, Save, X, CheckCircle2 } from 'lucide-react';
import { listItems, onBenchChange, readPhoto, updateItem, deleteItem, clearItems } from '../../lib/bench/benchStore.js';
import { exportCollecte } from '../../lib/bench/benchExport.js';
import { collectStats, itemStatus, labelFor, cardsSummary } from '../../lib/bench/benchFormat.js';
import { keyOf } from '../../lib/bench/benchScan.js';
import { getMatcher, LEVEL_LABEL } from '../../lib/cardMatcher.js';
import { useBackHandler } from '../../lib/backButton.js';
import CardChooser from './CardChooser.jsx';
import { FramedPhoto } from './GridLabeler.jsx';
import { tx } from '../../lib/i18n.js';

/** Folder of the bench on the PC (help texts). */
export const PC_BENCH_DIR = 'model\\real-photos-raw';

const SOURCE_LABEL = { photo: tx('Photo'), camera: tx('Image caméra'), 'scan-hesitant': tx('Scan hésitant') };
const STATUS_STYLE = { 'confirmé': 'text-[#7fd6a4] border-[#7fd6a4]/50', 'corrigé': 'text-[#f0c27a] border-[#f0c27a]/50', 'ajouté': 'text-sky-300 border-sky-300/50' };

/**
 * « Ma collecte » (MODULE-BANC.md 3, 4.3): the photos kept on this device,
 * to review, correct or delete, the counters, and the ZIP export.
 */
export default function MyCollection() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [exported, setExported] = useState(null);
  const [clearing, setClearing] = useState(false);
  // By default only the photos not exported yet (each ZIP stays small).
  const [all, setAll] = useState(false);

  useEffect(() => {
    const load = () => listItems().then(setItems).catch(err => setError(err.message));
    load();
    return onBenchChange(load);
  }, []);

  if (editing) return <ItemEditor item={editing} onClose={() => setEditing(null)} />;
  if (!items) return <p className="flex items-center gap-2 text-sm text-rift-300"><Loader2 className="w-4 h-4 animate-spin" /> {tx('Chargement…')}</p>;

  const st = collectStats(items);
  const fresh = items.filter(it => !it.exportedAt);
  const toExport = all ? items : fresh;
  const doExport = async () => {
    setError('');
    setExported(null);
    setExporting({ done: 0, total: toExport.length });
    try {
      const r = await exportCollecte(toExport, { onProgress: (done, total) => setExporting({ done, total }) });
      setExported(r);
    } catch (err) {
      setError(tx('Export impossible : {message}', { message: err.message }));
    }
    setExporting(null);
  };
  const doClear = async () => {
    setClearing(false);
    setExported(null);
    try { await clearItems(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[[st.photos, 'photos'], [st.cards, 'cartes'], [st.corrected, tx('corrigées')], [st.outside, 'hors catalogue']].map(([n, l]) => (
          <div key={l} className="p-2 border border-rift-600/60 bg-rift-800/40">
            <p className="text-lg font-bold text-gold-400">{n}</p>
            <p className="text-[11px] text-rift-400">{l}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <button onClick={doExport} disabled={!toExport.length || !!exporting} className="btn-primary w-full min-h-[48px] disabled:opacity-40">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? tx('Export… {done} / {total}', { done: exporting.done, total: exporting.total })
            : all ? tx('Tout réexporter ({length} photo{v1}, ZIP)', { length: items.length, v1: items.length > 1 ? 's' : '' })
              : tx('Exporter les nouvelles photos ({length}, ZIP)', { length: fresh.length })}
        </button>
        <label className="flex items-center gap-2 text-xs text-rift-300 cursor-pointer">
          <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} className="rounded" />
          {tx('Tout réexporter, y compris les')} {items.length - fresh.length} {tx('photo(s) déjà exportée(s)')}
        </label>
        <p className="text-[11px] text-rift-500 leading-relaxed">
          {tx('Sur le PC :')} <code className="text-rift-300">npm run bench:import -- &lt;fichier.zip&gt;</code> {tx('le range dans')}
          <span className="text-rift-300 break-all"> {PC_BENCH_DIR}</span> {tx('en fusionnant')} <code>_collecte.json</code>{tx('. Les positions GPS et les informations de l’appareil sont retirées des photos.')}
        </p>
        {exported && (
          <div role="status" className="p-3 border border-[#7fd6a4]/50 bg-rift-800/40 space-y-2">
            <p className="text-sm text-[#7fd6a4] flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> {exported.photos} {tx('photo(s),')} {exported.cards} {tx('carte(s) →')} <span className="break-all">{exported.where}</span></p>
            {!clearing ? (
              <button onClick={() => setClearing(true)} className="btn-ghost text-xs border border-rift-600 min-h-[40px] w-full">{tx('Vider la collecte de cet appareil ?')}</button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setClearing(false)} className="btn-secondary text-sm min-h-[40px]">{tx('Garder')}</button>
                <button onClick={doClear} className="btn-secondary text-sm min-h-[40px] !text-[#ff8a80] !border-[#ff8a80]/50"><Trash2 className="w-4 h-4" /> {tx('Vider')}</button>
              </div>
            )}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-[#ff8a80]">{error}</p>}
      </div>

      {!items.length ? (
        <p className="text-sm text-rift-400">{tx('Aucune photo pour l’instant. Prenez une carte seule ou une grille.')}</p>
      ) : (
        <ul className="space-y-2">
          {items.map(it => {
            const status = itemStatus(it);
            return (
              <li key={it.name}>
                <button onClick={() => setEditing(it)} className="w-full flex gap-3 p-2 border border-rift-600/60 bg-rift-800/40 hover:border-gold-500/50 text-left">
                  {it.thumb ? <img src={it.thumb} alt="" loading="lazy" className="w-16 h-16 object-cover flex-shrink-0 bg-rift-900" /> : <span className="w-16 h-16 bg-rift-900 flex-shrink-0" />}
                  <span className="flex-1 min-w-0 space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-rift-100">
                      {it.type === 'grille' ? <LayoutGrid className="w-4 h-4 text-gold-400" /> : <Square className="w-4 h-4 text-gold-400" />}
                      <span className="truncate">{it.type === 'grille' ? tx('Grille · {length} cartes', { length: it.cards.length }) : it.cards[0].final}</span>
                    </span>
                    {it.type === 'grille' && <span className="block text-xs text-rift-300 truncate">{it.cards.map(c => c.final).join(', ')}</span>}
                    <span className="block text-[11px] text-rift-400">{it.date.replace('T', ' ')} · {SOURCE_LABEL[it.source] || it.source}{it.exportedAt ? tx(' · exportée') : ''}</span>
                  </span>
                  <span className={`self-start px-1.5 py-0.5 text-[11px] border ${STATUS_STYLE[status]}`}>{status}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Reviewing one photo: change a card, add or remove one (grids), delete the photo. */
function ItemEditor({ item, onClose }) {
  const [cards, setCards] = useState(item.cards);
  const [url, setUrl] = useState(null);
  const [choosing, setChoosing] = useState(null); // index, or 'add'
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  useBackHandler(choosing === null, onClose);

  useEffect(() => {
    let u = null;
    readPhoto(item.name)
      .then(bytes => { u = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' })); setUrl(u); })
      .catch(err => setError(err.message));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [item.name]);

  const scannerCard = (c) => (c.scannerId ? getMatcher().getCardData(c.scannerId) : null);
  const choose = (choice) => {
    const final = choice.cardData ? keyOf(choice.cardData) : choice.freeCode;
    const finalId = choice.cardData ? choice.cardData.id : null;
    if (choosing === 'add') {
      setCards(cs => [...cs, { final, finalId, scanner: null, scannerId: null, level: null, label: tx('ajouté'), corners: null }]);
    } else {
      setCards(cs => cs.map((c, i) => (i === choosing ? { ...c, final, finalId, label: labelFor(final, c.scanner) } : c)));
    }
    setChoosing(null);
  };
  const changed = JSON.stringify(cards) !== JSON.stringify(item.cards);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      // corrected: exported again with the next « nouvelles photos »
      await updateItem({ ...item, cards, exportedAt: null });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await deleteItem(item.name);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-rift-100 mr-auto">{item.type === 'grille' ? tx('Grille') : tx('Carte seule')} · {item.date.replace('T', ' ')}</p>
        <button onClick={onClose} aria-label={tx('Fermer')} className="p-2 text-rift-400 hover:text-rift-100"><X className="w-5 h-5" /></button>
      </div>
      {url ? <FramedPhoto url={url} boxes={cards.map(c => ({ corners: c.corners, done: true }))} /> : !error && <Loader2 className="w-5 h-5 animate-spin text-rift-400" />}
      <p className="text-[11px] text-rift-500">{SOURCE_LABEL[item.source]} · {item.detector} · {item.engine} {tx('· seuils')} {item.thresholds?.join(' / ')} · {item.split === 'test' ? 'jeu de mesure' : 'jeu de calibrage'}{item.rejectedBoxes ? tx(' · {rejectedBoxes} cadre(s) écarté(s)', { rejectedBoxes: item.rejectedBoxes }) : ''}</p>
      <ol className="space-y-1.5">
        {cards.map((c, i) => (
          <li key={i} className="flex items-center gap-2 px-2 min-h-[48px] border border-rift-600/60 bg-rift-800/40">
            <span className="w-6 text-center text-sm font-bold text-gold-400">{i + 1}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-rift-100">{c.final}{!c.finalId && <span className="text-[11px] text-rift-400"> {tx('· hors catalogue')}</span>}</span>
              <span className="block text-[11px] text-rift-400">{tx('Scanner :')} {c.scanner || 'rien'}{c.level ? ` (${LEVEL_LABEL[c.level] || c.level})` : ''} · <span className={STATUS_STYLE[c.label]?.split(' ')[0]}>{c.label}</span></span>
            </span>
            <button onClick={() => setChoosing(i)} aria-label={tx('Changer la carte {v0}', { v0: i + 1 })} className="p-2 text-rift-300 hover:text-gold-400"><Pencil className="w-4 h-4" /></button>
            {item.type === 'grille' && cards.length > 1 && (
              <button onClick={() => setCards(cs => cs.filter((_, k) => k !== i))} aria-label={tx('Retirer la carte {v0}', { v0: i + 1 })} className="p-2 text-rift-400 hover:text-[#ff8a80]"><Trash2 className="w-4 h-4" /></button>
            )}
          </li>
        ))}
      </ol>
      {item.type === 'grille' && (
        <button onClick={() => setChoosing('add')} className="btn-secondary w-full text-sm min-h-[44px]"><Plus className="w-4 h-4" /> {tx('Ajouter une carte non détectée')}</button>
      )}
      {item.type === 'grille' && <p className="text-xs text-rift-300">{cardsSummary(cards)}</p>}
      {error && <p role="alert" className="text-sm text-[#ff8a80]">{error}</p>}
      <button onClick={save} disabled={!changed || busy} className="btn-primary w-full min-h-[48px] disabled:opacity-40"><Save className="w-4 h-4" /> {tx('Enregistrer les corrections')}</button>
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} disabled={busy} className="btn-ghost w-full text-sm min-h-[44px] border border-rift-600 !text-[#ff8a80]"><Trash2 className="w-4 h-4" /> {tx('Supprimer cette photo')}</button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-sm min-h-[44px]">{tx('Annuler')}</button>
          <button onClick={remove} disabled={busy} className="btn-secondary text-sm min-h-[44px] !text-[#ff8a80] !border-[#ff8a80]/50">{tx('Supprimer définitivement')}</button>
        </div>
      )}
      {choosing !== null && (
        <CardChooser
          title={choosing === 'add' ? tx('Carte non détectée : laquelle ?') : tx('Quelle est la bonne carte ?')}
          candidates={choosing !== 'add' && scannerCard(cards[choosing]) ? [scannerCard(cards[choosing])] : []}
          onChoose={choose}
          onCancel={() => setChoosing(null)}
        />
      )}
    </div>
  );
}
