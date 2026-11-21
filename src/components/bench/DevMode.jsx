import React, { useRef, useState, lazy, Suspense } from 'react';
import { Wrench, Camera, ChevronRight } from 'lucide-react';
import { usePrefs } from '../../lib/uiPrefs.js';
import { APP_VERSION, buildDateLabel } from '../../lib/appVersion.js';
import { tx } from '../../lib/i18n.js';

const BenchCollect = lazy(() => import('./BenchCollect.jsx'));

const TAPS = 7;

/**
 * Version number of « À propos »: 7 taps switch the developer mode on (as on
 * Android). The remaining taps are shown from the 4th one.
 */
export function VersionTapper({ className = '' }) {
  const [prefs, setPrefs] = usePrefs();
  const count = useRef({ n: 0, at: 0 });
  const [msg, setMsg] = useState('');
  const tap = () => {
    if (prefs.devMode) { setMsg(tx('Le mode développeur est déjà activé.')); return; }
    const now = Date.now();
    if (now - count.current.at > 2000) count.current.n = 0;
    count.current.at = now;
    count.current.n++;
    const left = TAPS - count.current.n;
    if (left <= 0) {
      count.current.n = 0;
      setPrefs({ devMode: true });
      setMsg(tx('Mode développeur activé : voir la section « Développeur ».'));
    } else if (left <= 3) {
      setMsg(tx('Encore {left} appui{v1} pour activer le mode développeur.', { left, v1: left > 1 ? 's' : '' }));
    }
  };
  return (
    <span className="block">
      <button type="button" onClick={tap} className={`select-none text-left ${className}`}>
        <span className="font-mono">v{APP_VERSION}</span>
        {buildDateLabel() && <span> · {buildDateLabel()}</span>}
      </button>
      {msg && <span role="status" className="block text-[11px] text-gold-400 mt-0.5">{msg}</span>}
    </span>
  );
}

/**
 * « Développeur » section (only when the mode is on): the bench collection,
 * the option to keep doubtful scans, and switching the mode off.
 */
export function DevSection({ bare = false }) {
  const [prefs, setPrefs] = usePrefs();
  const [open, setOpen] = useState(false);
  if (!prefs.devMode) return null;
  const body = (
    <div className="space-y-3">
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-3 min-h-[56px] border border-rift-600/60 bg-rift-800/40 hover:border-gold-500/50 text-left">
        <Camera className="w-5 h-5 text-gold-400 flex-shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-rift-100">{tx('Collecte banc d’essai')}</span>
          <span className="block text-xs text-rift-400">{tx('Photos de test étiquetées et confirmées, exportées au format du banc')}</span>
        </span>
        <ChevronRight className="w-5 h-5 text-rift-500" />
      </button>
      <label className="flex items-start gap-2 text-sm text-rift-200 cursor-pointer">
        <input type="checkbox" checked={!!prefs.benchKeepHesitant} onChange={e => setPrefs({ benchKeepHesitant: e.target.checked })} className="mt-0.5 rounded" />
        <span>
          {tx('Proposer de garder les scans hésitants pour le banc')}
          <span className="block text-[11px] text-rift-500">{tx('Quand le scanner demande « laquelle est-ce ? », un appui garde l’image dans la collecte ; la carte que vous choisissez lui sert d’étiquette.')}</span>
        </span>
      </label>
      <button onClick={() => setPrefs({ devMode: false, benchKeepHesitant: false })} className="btn-ghost w-full text-xs text-rift-400">
        {tx('Désactiver le mode développeur')}
      </button>
      <p className="text-[11px] text-rift-500">{tx('La collecte déjà prise reste sur l’appareil.')}</p>
    </div>
  );
  return (
    <>
      {bare ? body : (
        <section className="rounded-2xl bg-rift-800/60 border border-rift-600/20 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-rift-100 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-gold-400" />
            {tx('Développeur')}
          </h2>
          {body}
        </section>
      )}
      {open && (
        <Suspense fallback={null}>
          <BenchCollect onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
