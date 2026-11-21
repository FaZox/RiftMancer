import React, { useEffect, useState } from 'react';
import { Check, X, Undo2, Search, Plus, AlertTriangle, Copy, FlaskConical } from 'lucide-react';
import CardImage from '../common/CardImage.jsx';
import CardPicker from '../organize/CardPicker.jsx';
import { useBackHandler } from '../../lib/backButton.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { usePrefs } from '../../lib/uiPrefs.js';
import { variantOf, VARIANT_LABEL, printingLabel } from '../../lib/variants.js';
import { tx } from '../../lib/i18n.js';

const EMPTY = new Map();

/**
 * Result of a scan, shown at once on the camera (no need to open the list):
 *   success   — the card that was added + « Annuler » / « Pas la bonne carte »
 *   duplicate — same card as just before: add another copy?
 *   uncertain — doubtful match: nothing added, « laquelle est-ce ? »
 *   fail      — nothing recognised
 * Reprints with the same artwork (OGN / RAD / VEN…) show the sets to choose
 * from; the choice is remembered for the next scans of the session.
 * It hides itself after a few seconds (not while the user is choosing).
 * Developer mode, « garder les scans hésitants » (MODULE-BANC.md 2.3): on a
 * doubtful scan, one tap keeps the camera picture for the bench, labelled
 * with the card the user then picks.
 */
export default function ScanResultCard({ feedback, language, listQty, onUndo, onCorrect, onConfirmDuplicate, onDismiss }) {
  const [choosing, setChoosing] = useState(false);
  const [searching, setSearching] = useState(false);
  useBackHandler(choosing && !searching, () => setChoosing(false));
  const phase = feedback?.phase;
  const [prefs] = usePrefs();
  const offerBench = !!(prefs.devMode && prefs.benchKeepHesitant);
  const [keepBench, setKeepBench] = useState(false);
  const [benchMsg, setBenchMsg] = useState(null);

  // A new scan result closes the « Pas la bonne carte » choice.
  useEffect(() => { setChoosing(false); setSearching(false); setKeepBench(false); }, [feedback]);
  useEffect(() => {
    if (!benchMsg) return undefined;
    const t = setTimeout(() => setBenchMsg(null), 4000);
    return () => clearTimeout(t);
  }, [benchMsg]);

  // Auto-hide: success 4 s, duplicate 6 s, fail 2 s — but not while the
  // user is choosing the right card.
  useEffect(() => {
    if (!phase || phase === 'scanning' || phase === 'success' || phase === 'uncertain' || choosing || searching) return undefined;
    const ms = phase === 'duplicate' ? 6000 : 2500;
    const t = setTimeout(() => onDismiss(), ms);
    return () => clearTimeout(t);
  }, [feedback, phase, choosing, searching, onDismiss]);

  if (!phase || phase === 'scanning') return null;
  const lang = displayLanguage(language);

  if (phase === 'fail') {
    return (
      <div role="status" className="scan-pop flex items-center gap-3 px-3 py-3 bg-rift-800 border-2 border-[#ff8a80]/70 shadow-xl">
        <span className="hexagon w-9 h-9 flex items-center justify-center bg-[#ff8a80] flex-shrink-0"><X className="w-5 h-5 text-rift-900" strokeWidth={3} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-rift-100">{tx('Carte non reconnue')}</p>
          <p className="text-xs text-rift-400">{tx('Cadrez la carte entière, sans reflet, puis scannez à nouveau.')}</p>
        </div>
      </div>
    );
  }

  const { result } = feedback;
  const card = result.cardData;
  const name = getLocalizedName(card, lang);
  const pct = Math.round((result.similarity || 0) * 100);
  const levelText = result.level === 'sure' ? tx('sûr') : result.level === 'probable' ? 'probable' : null;

  // The card chosen by the user; on a doubtful scan, the picture is kept for the bench if asked.
  const correct = (cardData) => {
    if (phase === 'uncertain' && keepBench && result.frame) {
      import('../../lib/bench/benchScan.js')
        .then(m => m.keepHesitantScan(result, cardData))
        .then(() => setBenchMsg({ ok: true, text: tx('Image gardée pour le banc d’essai.') }))
        .catch(err => setBenchMsg({ ok: false, text: tx('Image non gardée pour le banc : {message}', { message: err.message }) }));
    }
    onCorrect(cardData);
  };
  const benchLine = benchMsg && (
    <p role="status" className={`text-[11px] flex items-center gap-1 ${benchMsg.ok ? 'text-[#7fd6a4]' : 'text-[#ff8a80]'}`}><FlaskConical className="w-3.5 h-3.5" /> {benchMsg.text}</p>
  );

  const picker = searching && (
    <CardPicker
      title={tx('Quelle est la bonne carte ?')}
      initialQuery={card.name}
      ownedByCard={EMPTY}
      onPick={(c) => { setSearching(false); setChoosing(false); correct(c); }}
      onClose={() => setSearching(false)}
    />
  );

  if (phase === 'uncertain') {
    const cands = result.candidates?.length ? result.candidates : [{ cardData: card, similarity: result.similarity }];
    return (
      <>
        <div role="status" className="scan-pop p-3 bg-rift-800 border-2 border-[#f0c27a]/80 shadow-xl space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#f0c27a] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-rift-100">{tx('Carte incertaine — laquelle est-ce ?')}</p>
              <p className="text-xs text-rift-400">{tx('Rien n’a été ajouté. Touchez la bonne carte, ou cherchez-la.')}</p>
            </div>
            <button onClick={onDismiss} aria-label={tx('Fermer')} className="p-1 text-rift-400 hover:text-rift-100"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {cands.map(a => (
              <button key={a.cardData.id} onClick={() => correct(a.cardData)} title={getLocalizedName(a.cardData, lang)} className="border border-rift-600 hover:border-gold-400 relative">
                <CardImage cardData={a.cardData} />
                <span className="absolute bottom-0 inset-x-0 bg-rift-900/80 text-[11px] text-rift-200 text-center leading-tight py-px">{Math.round(a.similarity * 100)} %</span>
              </button>
            ))}
          </div>
          <button onClick={() => setSearching(true)} className="btn-secondary text-sm min-h-[44px] w-full"><Search className="w-4 h-4" /> {tx('Chercher')}</button>
          {offerBench && result.frame && (
            <button onClick={() => setKeepBench(k => !k)} aria-pressed={keepBench}
              className={`w-full min-h-[40px] text-xs border flex items-center justify-center gap-1.5 ${keepBench ? 'bg-gold-500/15 border-gold-400 text-gold-400 font-semibold' : 'border-rift-600 text-rift-300'}`}>
              <FlaskConical className="w-4 h-4" /> {keepBench ? tx('Gardée pour le banc : touchez la bonne carte') : tx('Garder cette image pour le banc d’essai')}
            </button>
          )}
          {benchLine}
        </div>
        {picker}
      </>
    );
  }

  if (phase === 'duplicate') {
    return (
      <div role="status" className="scan-pop p-3 bg-rift-800 border-2 border-[#f0c27a]/80 shadow-xl space-y-2.5">
        <div className="flex items-center gap-3">
          <span className="w-11 flex-shrink-0 border border-rift-600"><CardImage cardData={card} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#f0c27a] flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> {tx('Même carte que juste avant')}</p>
            <p className="text-[15px] font-bold text-rift-100 truncate">{name}</p>
            <p className="text-xs text-rift-400">{tx('C’est un autre exemplaire ?')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onDismiss} className="btn-secondary text-sm min-h-[44px]">{tx('Non, ignorer')}</button>
          <button onClick={onConfirmDuplicate} className="btn-primary text-sm min-h-[44px]"><Plus className="w-4 h-4" /> {tx('Oui, +1')}</button>
        </div>
      </div>
    );
  }

  // success
  const alts = result.alternatives || [];
  return (
    <>
      <div role="status" className="scan-pop p-3 bg-rift-800 border-2 border-[#7fd6a4]/80 shadow-xl space-y-2.5">
        {benchLine}
        <div className="flex items-center gap-3">
          <span className="relative w-14 flex-shrink-0 border border-rift-600">
            <CardImage cardData={card} />
            <span className="hexagon absolute -right-2 -bottom-2 w-7 h-7 flex items-center justify-center bg-[#7fd6a4]"><Check className="w-4 h-4 text-rift-900" strokeWidth={3} /></span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#7fd6a4]">
              {feedback.corrected ? tx('Carte corrigée') : tx('Dernière carte ajoutée')}
              {listQty > 0 && <span className="text-rift-300 font-normal"> · ×{listQty} {tx('dans la liste')}</span>}
            </p>
            <p className="text-[16px] font-bold leading-tight text-rift-100 line-clamp-2">{name}</p>
            <p className="text-xs text-rift-400">{card.setName} · #{card.collectorNumber}{!feedback.corrected && ` · ${pct} %${levelText ? ` (${levelText})` : ''}`}</p>
            {variantOf(card.id) && <p className="text-[12px] font-semibold text-gold-400">{VARIANT_LABEL[variantOf(card.id)]}</p>}
          </div>
        </div>
        {(result.printings?.length || 0) > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-rift-400">{tx('Même illustration :')}</span>
            {result.printings.map(p => (
              <button
                key={p.id}
                onClick={() => { if (p.id !== card.id) onCorrect(p); }}
                aria-pressed={p.id === card.id}
                className={`px-2 py-1 text-[11px] font-semibold border ${p.id === card.id ? 'bg-gold-500/20 border-gold-400 text-gold-400' : 'border-rift-600 text-rift-200 hover:border-gold-400'}`}
              >
                {printingLabel(p)}
              </button>
            ))}
          </div>
        )}
        {!choosing ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onUndo} className="btn-secondary text-sm min-h-[44px]"><Undo2 className="w-4 h-4" /> {tx('Annuler')}</button>
            <button onClick={() => setChoosing(true)} className="btn-secondary text-sm min-h-[44px] !text-[#f0c27a] !border-[#f0c27a]/50"><AlertTriangle className="w-4 h-4" /> {tx('Pas la bonne carte')}</button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-rift-300">{tx('C’est plutôt :')}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {alts.map(a => (
                <button key={a.cardData.id} onClick={() => { setChoosing(false); onCorrect(a.cardData); }} title={getLocalizedName(a.cardData, lang)} className="border border-rift-600 hover:border-gold-400">
                  <CardImage cardData={a.cardData} />
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSearching(true)} className="btn-secondary text-sm min-h-[44px]"><Search className="w-4 h-4" /> {tx('Chercher')}</button>
              <button onClick={() => setChoosing(false)} className="btn-ghost text-sm min-h-[44px]">{tx('Retour')}</button>
            </div>
          </div>
        )}
      </div>
      {picker}
    </>
  );
}
