import React, { useState } from 'react';
import { Plus, Save, X, Check, Ban, Pencil, Trash2, Loader2 } from 'lucide-react';
import CardLabeler from './CardLabeler.jsx';
import CardChooser from './CardChooser.jsx';
import { decideCard, saveCollected } from '../../lib/bench/benchScan.js';
import { cardsSummary } from '../../lib/bench/benchFormat.js';
import { useBackHandler } from '../../lib/backButton.js';
import { tx } from '../../lib/i18n.js';

const LABEL_STYLE = { 'confirmé': 'text-[#7fd6a4]', 'corrigé': 'text-[#f0c27a]', 'ajouté': 'text-sky-300' };

/** The photo with every detected card framed and numbered. */
export function FramedPhoto({ url, boxes, active }) {
  return (
    <div className="relative bg-rift-900 border border-rift-600">
      <img src={url} alt={tx('Photo')} className="block w-full h-auto max-h-[55vh] object-contain" />
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
        {boxes.map((b, i) => b.corners && (
          <polygon key={i} points={b.corners.map(p => p.join(',')).join(' ')} fill="none"
            stroke={b.rejected ? '#ff8a80' : i === active ? '#ffd27a' : b.done ? '#7fd6a4' : '#c8aa6e'}
            strokeWidth={i === active ? 0.006 : 0.004} strokeDasharray={b.rejected ? '0.01 0.01' : undefined} />
        ))}
      </svg>
      {boxes.map((b, i) => b.corners && (
        <span key={i} className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[22px] h-[22px] px-1 text-[12px] font-bold flex items-center justify-center ${b.rejected ? 'bg-[#ff8a80]' : b.done ? 'bg-[#7fd6a4]' : 'bg-gold-400'} text-rift-900`}
          style={{ left: `${(100 * b.corners.reduce((s, p) => s + p[0], 0)) / 4}%`, top: `${(100 * b.corners.reduce((s, p) => s + p[1], 0)) / 4}%` }}>
          {i + 1}
        </span>
      ))}
    </div>
  );
}

/**
 * Grid (MODULE-BANC.md 2.2): every card of the photo confirmed or corrected
 * one by one, the cards YOLO missed added by hand, false detections marked
 * « Ce n'est pas une carte ». Saved only when every frame is decided.
 */
export default function GridLabeler({ picture, analysis, source, jpeg, thumbSource, onSaved, onCancel }) {
  const [rows, setRows] = useState(() => analysis.detections.map(det => ({ det, decision: null, rejected: false })));
  const [added, setAdded] = useState([]);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useBackHandler(open !== null, () => setOpen(null));

  const decide = (i, choice) => {
    setRows(r => r.map((x, k) => (k === i ? { ...x, decision: decideCard(x.det, choice), rejected: false } : x)));
    // next card still to decide
    const next = rows.findIndex((x, k) => k > i && !x.decision && !x.rejected);
    setOpen(next >= 0 ? next : null);
  };
  const reject = (i) => {
    setRows(r => r.map((x, k) => (k === i ? { ...x, decision: null, rejected: true } : x)));
    setOpen(null);
  };
  const left = rows.filter(x => !x.decision && !x.rejected).length;
  const cards = [...rows.filter(x => x.decision && !x.rejected).map(x => x.decision), ...added];
  const rejected = rows.filter(x => x.rejected).length;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const item = await saveCollected({
        type: 'grille', source, info: analysis.info, cards, rejectedBoxes: rejected,
        jpeg, thumbSource, width: picture.width, height: picture.height,
      });
      onSaved(item);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <FramedPhoto url={picture.url} active={open}
        boxes={rows.map(x => ({ corners: x.det.corners, done: !!x.decision, rejected: x.rejected }))} />
      <p className="text-xs text-rift-400">{tx('Touchez chaque carte pour la confirmer ou la corriger. Une carte présente deux fois compte deux fois.')}</p>

      <ol className="space-y-1.5">
        {rows.map((x, i) => (
          <li key={i}>
            <button onClick={() => setOpen(i)} aria-expanded={open === i}
              className={`w-full flex items-center gap-2 px-2 min-h-[48px] border text-left ${open === i ? 'border-gold-400 bg-rift-800' : 'border-rift-600/60 bg-rift-800/40'}`}>
              <span className="w-6 text-center text-sm font-bold text-gold-400">{i + 1}</span>
              <span className="flex-1 min-w-0 text-sm text-rift-100 truncate">
                {x.rejected ? <span className="text-[#ff8a80]">{tx('Pas une carte')}</span>
                  : x.decision ? <>{x.decision.final} <span className={`text-xs ${LABEL_STYLE[x.decision.label]}`}>· {x.decision.label}</span></>
                    : <span className="text-rift-400">{x.det.scanner ? `${x.det.scanner.key} ?` : tx('Non reconnue')} {tx('— à confirmer')}</span>}
              </span>
              {x.rejected ? <Ban className="w-4 h-4 text-[#ff8a80]" /> : x.decision ? <Check className="w-4 h-4 text-[#7fd6a4]" /> : <Pencil className="w-4 h-4 text-rift-400" />}
            </button>
            {open === i && (
              <div className="border border-t-0 border-gold-400 p-3 bg-rift-800">
                <CardLabeler det={x.det} number={i + 1} onDecide={(c) => decide(i, c)} onReject={() => reject(i)} />
              </div>
            )}
          </li>
        ))}
        {added.map((c, k) => (
          <li key={`a${k}`} className="flex items-center gap-2 px-2 min-h-[48px] border border-rift-600/60 bg-rift-800/40">
            <span className="w-6 text-center text-sm font-bold text-sky-300">+</span>
            <span className="flex-1 text-sm text-rift-100">{c.final} <span className={`text-xs ${LABEL_STYLE['ajouté']}`}>{tx('· ajoutée à la main')}</span></span>
            <button onClick={() => setAdded(a => a.filter((_, j) => j !== k))} aria-label={tx('Retirer cette carte')} className="p-2 text-rift-400 hover:text-[#ff8a80]"><Trash2 className="w-4 h-4" /></button>
          </li>
        ))}
      </ol>

      <button onClick={() => setAdding(true)} className="btn-secondary w-full text-sm min-h-[44px]"><Plus className="w-4 h-4" /> {tx('Ajouter une carte non détectée')}</button>

      <div className="p-3 border border-rift-600/60 bg-rift-900/50 space-y-2">
        <p className="text-sm text-rift-100">{cardsSummary(cards)}{rejected ? tx(' · {rejected} cadre{v1} écarté{v2}', { rejected, v1: rejected > 1 ? 's' : '', v2: rejected > 1 ? 's' : '' }) : ''}</p>
        {left > 0 && <p className="text-xs text-[#f0c27a]">{tx('Encore')} {left} {tx('carte')}{left > 1 ? 's' : ''} {tx('à confirmer ou corriger avant d’enregistrer.')}</p>}
        {error && <p className="text-xs text-[#ff8a80]">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel} disabled={saving} className="btn-ghost text-sm min-h-[44px] border border-rift-600"><X className="w-4 h-4" /> {tx('Abandonner')}</button>
          <button onClick={save} disabled={saving || left > 0 || !cards.length} className="btn-primary text-sm min-h-[44px] disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {tx('Enregistrer')}
          </button>
        </div>
      </div>

      {adding && (
        <CardChooser title={tx('Carte non détectée : laquelle ?')} onCancel={() => setAdding(false)}
          onChoose={(choice) => { setAdding(false); setAdded(a => [...a, decideCard(null, choice)]); }} />
      )}
    </div>
  );
}
