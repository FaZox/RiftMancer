import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, Package, ShieldCheck, Upload } from 'lucide-react';
import Sheet from '../common/Sheet.jsx';
import Banner from '../common/Banner.jsx';
import DiffList from '../common/DiffList.jsx';
import { Stepper, ProgressRow } from '../common/Progress.jsx';import { tx, locale } from '../../lib/i18n.js';


/**
 * Content packs (lot 4.5, B.6.1 « PACKS »): « Importer un pack… » (signed by
 * the app's author, checked by the PC app's main process) and « Exporter mon
 * contenu » (to sign with npm run pack:sign before giving it).
 */
const STEPS = ['Recherche', tx('Résumé'), 'Installation', tx('Terminé')];
const LABEL = { cartes: tx('Cartes'), traductions: tx('Traductions françaises'), bannies: tx('Cartes bannies') };
const day = (d) => (d ? new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function PackSheet({ open, onClose }) {
  const api = window.riftboundDesktop;
  const [step, setStep] = useState(0);
  const [pack, setPack] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep(0); setPack(null); setError(null);
    (async () => {
      try {
        const p = await api.pack.open();
        if (!p) { onClose(); return; }
        setPack(p);
        setStep(1);
      } catch (err) {
        setError(String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
      }
    })();
  }, [open, api, onClose]);

  const install = async () => {
    setStep(2); setError(null);
    try { await api.pack.install(); setStep(3); } catch (err) { setStep(1); setError(err.message); }
  };
  const cancel = () => { api.pack.cancel(); onClose(); };

  return (
    <Sheet open={open} onClose={step === 2 ? undefined : cancel} title={tx('Importer un pack')}>
      <div className="space-y-4">
        <Stepper steps={STEPS} current={step} />
        {step === 0 && !error && <ProgressRow done={0} total={null} unit={tx('Vérification du pack…')} />}
        {error && <Banner tone="bad">{error}</Banner>}
        {step === 1 && pack && (
          <>
            <p className="text-[15px] text-rift-100">{pack.name} {tx('· exporté le')} {day(pack.createdAt)}</p>
            <p className="flex items-center gap-2 text-[13px] text-state-ok"><ShieldCheck size={16} /> {tx('Pack signé par l’auteur de l’appli (clé')} {pack.key})</p>
            <DiffList items={Object.entries(pack.layers).map(([k, l]) => ({
              op: pack.newer.includes(k) ? '~' : '-',
              label: LABEL[k] || k,
              detail: pack.newer.includes(k) ? `du ${day(l.createdAt)}${l.count != null ? ` · ${l.count} éléments` : ''}` : tx('déjà à jour, ignoré'),
            }))} />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={cancel} className="btn-ghost text-[14px] py-2 px-4">{tx('Annuler')}</button>
              <button onClick={install} className="btn-primary text-[14px] py-2 px-4">{tx('Installer')}</button>
            </div>
          </>
        )}
        {step === 2 && <ProgressRow done={0} total={null} unit={tx('Installation… Ne fermez pas l’appli.')} />}
        {step === 3 && (
          <div className="text-center py-4 space-y-3">
            <span className="hex-cut inline-flex w-14 h-14 items-center justify-center bg-gold-400/15 text-gold-400"><CheckCircle2 size={28} /></span>
            <p className="text-[15px] text-rift-100">{tx('Pack installé.')}</p>
            <p className="text-[13px] text-rift-400">{tx('Le téléphone recevra ces changements à la prochaine synchro.')}</p>
            <button onClick={onClose} className="btn-primary text-[14px] py-2 px-4">{tx('Fermer')}</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** « PACKS [Importer un pack…] [Exporter mon contenu] · Dernier pack importé : … · signé ✓ » */
export default function PacksRow({ info }) {
  const api = window.riftboundDesktop;
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(null);
  const close = useCallback(() => setOpen(false), []); // stable: the sheet opens the file dialog once
  const hasLayers = Object.values(info.layers || {}).some(Boolean);
  const exportPack = async () => {
    setMsg(null);
    try {
      const r = await api.pack.export();
      if (r) setMsg({ ok: true, text: tx('Pack exporté : {file}. Il n’est accepté par les autres appareils qu’une fois signé par l’auteur de l’appli (npm run pack:sign).', { file: r.file }) });
    } catch (err) { setMsg({ ok: false, text: String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }); }
  };
  return (
    <section className="pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 text-[13px] font-bold tracking-wider uppercase text-rift-300"><Package size={16} /> {tx('Packs')}</h3>
        <button onClick={() => setOpen(true)} className="btn-secondary text-[13px] py-2 px-3"><Download className="w-4 h-4" /> {tx('Importer un pack…')}</button>
        <button onClick={exportPack} disabled={!hasLayers} className="btn-ghost text-[13px] py-2 px-3"><Upload className="w-4 h-4" /> {tx('Exporter mon contenu')}</button>
      </div>
      <p className="text-[13px] text-rift-400 mt-2">
        {info.lastPack ? <>{tx('Dernier pack importé :')} {info.lastPack.name.replace(/\.rbpack$/, '')} · <span className="text-state-ok">{tx('signé ✓')}</span></> : tx('Un ami a fait la mise à jour ? Importez son pack, même sans Internet.')}
      </p>
      {msg && <p role="status" className={`text-[13px] mt-1 ${msg.ok ? 'text-rift-300' : 'text-state-bad'}`}>{msg.text}</p>}
      <PackSheet open={open} onClose={close} />
    </section>
  );
}
