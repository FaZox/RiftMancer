import React, { useState } from 'react';
import { Download, Upload, HardDrive } from 'lucide-react';
import { SectionCard } from '../common/SectionCard.jsx';
import { useDialog } from '../common/Dialog.jsx';
import { exportBackup, parseBackup, restoreBackup } from '../../lib/localBackup.js';
import { tx, locale } from '../../lib/i18n.js';

/** Settings: save the whole collection in a file / restore it (no PC needed). */
export default function LocalBackupSection() {
  const { ask } = useDialog();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const doExport = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await exportBackup();
      setMsg({ ok: true, text: tx('Sauvegarde enregistrée ({copies} cartes) : {where}', { copies: r.copies, where: r.where }) });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const doImport = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const b = parseBackup(await f.text());
      const date = b.at ? new Date(b.at).toLocaleString(locale()) : '?';
      const ok = await ask({
        title: tx('Restaurer ce fichier ?'),
        message: tx('Remplacer toute la collection par cette sauvegarde du {date} ({copies} cartes) ?\n\nL’état actuel est d’abord sauvegardé : vous pourrez y revenir.', { date, copies: b.copies }),
        confirmLabel: tx('Restaurer'),
      });
      if (!ok) return;
      await restoreBackup(b);
      setMsg({ ok: true, text: tx('Sauvegarde du {date} restaurée.', { date }) });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  return (
    <SectionCard icon={HardDrive} title={tx('Fichier de sauvegarde')}>
      <p className="text-[13px] text-rift-400">{tx('Toute la collection (cartes, souhaits, boîtes, decks, prêts, échanges) dans un fichier, à garder ou à copier ailleurs.')}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={doExport} disabled={busy} className="btn-secondary text-[13px] py-2 px-3"><Download className="w-4 h-4" /> {tx('Enregistrer une sauvegarde')}</button>
        <label className={`btn-ghost text-[13px] py-2 px-3 cursor-pointer ${busy ? 'opacity-40 pointer-events-none' : ''}`}>
          <Upload className="w-4 h-4" /> {tx('Restaurer un fichier…')}
          <input type="file" accept=".json,application/json" onChange={doImport} className="hidden" />
        </label>
      </div>
      {msg && <p role="status" className={`text-[13px] mt-2 break-all ${msg.ok ? 'text-state-ok' : 'text-state-bad'}`}>{msg.text}</p>}
    </SectionCard>
  );
}
