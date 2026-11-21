import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FileUp, RefreshCw } from 'lucide-react';
import Sheet from '../common/Sheet.jsx';
import Banner from '../common/Banner.jsx';
import DiffList from '../common/DiffList.jsx';
import { Stepper, ProgressRow } from '../common/Progress.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { FR_URLS, changesText, translationLayer } from '../../lib/frTranslations.js';
import { clearNotice, translationsFrom } from '../../lib/contentNotices.js';
import { tx } from '../../lib/i18n.js';

/**
 * « Mettre à jour les traductions françaises » (lot 4.3) in the B.6.2 flow.
 * `mode`: 'download' (simple download, honest), 'import' (the two files
 * downloaded by the user), or `files` already fetched by the weekly check.
 */
const STEPS = ['Recherche', tx('Résumé'), 'Installation', tx('Terminé')];

export default function TranslationsSheet({ open, onClose, mode = 'download', files = null, validators = null }) {
  const api = window.riftboundDesktop;
  const [step, setStep] = useState(0);
  const [how, setHow] = useState(mode);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const summarize = useCallback((texts) => {
    const r = translationsFrom(texts);
    setResult(r);
    setStep(1);
  }, []);

  const download = useCallback(async () => {
    setStep(0); setError(null); setResult(null);
    try {
      const texts = [];
      for (const url of FR_URLS) {
        const r = await api.content.fetch(url);
        if (!r.ok) { setError({ text: r.message, reason: r.reason }); return; }
        texts.push(r.text);
      }
      summarize(texts);
    } catch (err) {
      setError({ text: err.message, reason: 'unreadable' });
    }
  }, [api, summarize]);

  useEffect(() => {
    if (!open) return;
    setHow(mode); setError(null); setResult(null); setStep(0);
    if (files) { try { summarize(files); } catch (err) { setError({ text: err.message, reason: 'unreadable' }); } } else if (mode === 'download') download();
  }, [open, mode, files, download, summarize]);

  const importFiles = async (list) => {
    setError(null);
    try {
      const texts = await Promise.all([...list].slice(0, 2).map(f => f.text()));
      summarize(texts);
    } catch (err) {
      setError({ text: err.message, reason: 'import' });
    }
  };

  const install = async () => {
    setStep(2);
    try {
      await api.content.install('traductions', translationLayer(result.tr));
      if (validators) await api.content.saveValidators('traductions', validators);
      clearNotice('traductions');
      setStep(3);
    } catch (err) {
      setStep(1);
      setError({ text: err.message, reason: 'install' });
    }
  };

  const items = useMemo(() => {
    if (!result) return [];
    const byId = new Map(getMatcher().cards.map(c => [c.id, c]));
    const ids = [...new Set([...result.changes.names, ...result.changes.texts])];
    return ids.map(id => {
      const c = byId.get(id);
      const name = result.tr.names[id] || c?.nameFr || c?.name || id;
      return { op: c?.nameFr ? '~' : '+', label: name, cardId: id, detail: result.changes.texts.includes(id) ? 'texte' : 'nom' };
    });
  }, [result]);

  return (
    <Sheet open={open} onClose={onClose} title={tx('Traductions françaises')}>
      <div className="space-y-4">
        <Stepper steps={STEPS} current={step} />
        {step === 0 && how === 'download' && !error && <ProgressRow done={0} total={null} unit={tx('Téléchargement depuis riftboundfr.fr…')} />}
        {step === 0 && how === 'import' && (
          <label onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); importFiles(e.dataTransfer.files); }}
            className={`block border border-dashed p-6 text-center cursor-pointer ${dragOver ? 'border-gold-400 bg-gold-400/5' : 'border-rift-600'}`}>
            <FileUp className="mx-auto text-gold-400" size={28} />
            <span className="block text-[14px] text-rift-100 mt-2">{tx('Choisissez ou déposez les deux fichiers')}</span>
            <span className="block text-[13px] text-rift-400">{tx('repertoire-cartes.json et textes-cartes.json')}</span>
            <input type="file" accept=".json,application/json" multiple className="hidden" onChange={e => importFiles(e.target.files)} />
          </label>
        )}
        {error && (
          <Banner tone="bad">
            {error.text}
            <span className="flex flex-wrap gap-2 mt-2">
              {error.reason === 'offline' && <button onClick={download} className="btn-secondary text-[13px] py-1.5 px-3"><RefreshCw className="w-4 h-4" /> {tx('Réessayer')}</button>}
              {['refused', 'unavailable', 'http'].includes(error.reason) && (
                <button onClick={() => FR_URLS.forEach(u => window.open(u, '_blank'))} className="btn-secondary text-[13px] py-1.5 px-3"><ExternalLink className="w-4 h-4" /> {tx('Ouvrir les deux fichiers dans mon navigateur')}</button>
              )}
              {how !== 'import' && <button onClick={() => { setHow('import'); setError(null); }} className="btn-ghost text-[13px] py-1.5 px-3"><FileUp className="w-4 h-4" /> {tx('Importer des fichiers…')}</button>}
            </span>
          </Banner>
        )}
        {step === 1 && result && (
          <>
            <p className="text-[15px] text-rift-100">{changesText(result.changes)}</p>
            {items.length > 0 && <DiffList items={items} />}
            {result.tr.unknown > 0 && <p className="text-[13px] text-rift-400">{result.tr.unknown} {tx('entrées du site ignorées : cartes absentes du catalogue (promos, extension pas encore installée).')}</p>}
            <p className="text-[13px] text-rift-400">{tx('Traductions de la communauté riftboundfr.fr, merci à eux.')}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="btn-ghost text-[14px] py-2 px-4">{items.length ? tx('Annuler') : tx('Fermer')}</button>
              {items.length > 0 && <button onClick={install} className="btn-primary text-[14px] py-2 px-4">{tx('Installer')}</button>}
            </div>
          </>
        )}
        {step === 2 && <ProgressRow done={0} total={null} unit={tx('Installation… Ne fermez pas l’appli.')} />}
        {step === 3 && (
          <div className="text-center py-4 space-y-3">
            <span className="hex-cut inline-flex w-14 h-14 items-center justify-center bg-gold-400/15 text-gold-400"><CheckCircle2 size={28} /></span>
            <p className="text-[15px] text-rift-100">{tx('Traductions mises à jour.')}</p>
            <p className="text-[13px] text-rift-400">{tx('Le téléphone recevra ces changements à la prochaine synchro.')}</p>
            <button onClick={onClose} className="btn-primary text-[14px] py-2 px-4">{tx('Fermer')}</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
