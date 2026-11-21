import React, { useState } from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { APP_VERSION } from '../../lib/appVersion.js';
import { tx } from '../../lib/i18n.js';

/**
 * « Écran de secours » (lot 5, B.6.10, tel-14): full screen, hexagon outlined
 * in state.bad, « Un problème est survenu », a reassuring sentence, three
 * stacked buttons — the main action (« Recharger », or « Réessayer » at
 * start-up), « Sauvegarder mes données dans un fichier », « Créer un rapport » —
 * and the technical detail folded, in mono 12 px.
 * Works without the rest of the app (the dialogs may be what broke).
 */
export default function RescueScreen({ title = tx('Un problème est survenu'), message, error, where, primary, extra, full = true }) {
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const run = async (what, fn) => {
    setBusy(what); setResult(null);
    try { setResult({ ok: true, text: await fn() }); } catch (err) { setResult({ ok: false, text: String(err?.message || err) }); } finally { setBusy(null); }
  };
  const backup = () => run('backup', async () => {
    const { exportBackup } = await import('../../lib/localBackup.js');
    const r = await exportBackup();
    return tx('Données enregistrées ({copies} cartes) : {where}', { copies: r.copies, where: r.where });
  });
  const report = () => run('report', async () => {
    const { createReport } = await import('../../lib/diagnosticReport.js');
    const r = await createReport();
    return tx('Rapport créé : {where}. Il ne contient aucune carte, aucun nom, aucun mot de passe.', { where: r.where });
  });
  const detail = [error?.name || 'Erreur', where, `v${APP_VERSION}`].filter(Boolean).join(' · ');
  return (
    <div role="alert" className={`${full ? 'min-h-[100dvh]' : 'min-h-[60vh]'} w-full bg-rift-900 flex items-center justify-center px-4 py-10`}>
      <div className="w-full max-w-sm text-center space-y-4">
        <svg viewBox="0 0 64 72" className="mx-auto w-16 h-[72px]" aria-hidden="true">
          <polygon points="32,3 61,19.5 61,52.5 32,69 3,52.5 3,19.5" fill="none" className="stroke-state-bad" strokeWidth="3" />
          <text x="32" y="46" textAnchor="middle" className="fill-state-bad" fontSize="30" fontWeight="700">!</text>
        </svg>
        <h1 className="font-display text-[22px] font-bold text-gold-400">{title}</h1>
        <p className="text-[15px] text-rift-200">{message || tx('Vos cartes ne sont pas perdues. Rechargez l’appli ; si le problème revient, créez un rapport.')}</p>
        <div className="flex flex-col gap-2 pt-2">
          <button onClick={primary?.onClick || (() => location.reload())} className="btn-primary w-full text-[15px] py-2.5">
            <RefreshCw className="w-4 h-4" /> {primary?.label || tx('Recharger')}
          </button>
          {extra}
          <button onClick={backup} disabled={!!busy} className="btn-secondary w-full text-[14px] py-2.5">
            <Download className="w-4 h-4" /> {busy === 'backup' ? tx('Enregistrement…') : tx('Sauvegarder mes données dans un fichier')}
          </button>
          <button onClick={report} disabled={!!busy} className="btn-ghost w-full text-[14px] py-2.5">
            <FileText className="w-4 h-4" /> {busy === 'report' ? tx('Création…') : tx('Créer un rapport')}
          </button>
        </div>
        {result && <p role="status" className={`text-[13px] break-all ${result.ok ? 'text-state-ok' : 'text-state-bad'}`}>{result.text}</p>}
        <details className="text-left text-rift-400">
          <summary className="cursor-pointer text-[13px]">{tx('Détail technique')}</summary>
          <p className="font-mono text-[12px] mt-1 break-all">{detail}</p>
          {error?.message && <p className="font-mono text-[12px] mt-1 break-all text-rift-500">{error.message}</p>}
        </details>
      </div>
    </div>
  );
}
