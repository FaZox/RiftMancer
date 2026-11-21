import React, { useEffect, useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { useDialog } from '../common/Dialog.jsx';
import Sheet from '../common/Sheet.jsx';
import { WhatsNewList, currentNotes } from '../common/WhatsNew.jsx';
import { getSyncState, subscribeSync } from '../../lib/syncClient.js';
import { tx, locale } from '../../lib/i18n.js';

const day = (t) => new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * À propos (lot 4.6, B.4 line 9): the version of the other device seen at the
 * last sync, and « Nouveautés » of this version.
 */
export default function AboutVersions() {
  const api = typeof window !== 'undefined' ? window.riftboundDesktop : null;
  const [phones, setPhones] = useState([]);
  const [s, setS] = useState(getSyncState);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (api) { api.sync.info().then(i => setPhones(i.devices || [])).catch(() => {}); return undefined; }
    return subscribeSync(setS);
  }, [api]);
  const notes = currentNotes();
  const { inform } = useDialog();
  const [busy, setBusy] = useState(false);
  const report = async () => {
    setBusy(true);
    try {
      const { createReport } = await import('../../lib/diagnosticReport.js');
      const r = await createReport();
      await inform({ title: tx('Rapport créé'), message: tx('{where}\n\nVersions, réglages du scanner, dernières erreurs. Aucune carte, aucun nom, aucun mot de passe.', { where: r.where }) });
    } catch (err) {
      await inform({ title: tx('Rapport impossible'), message: err.message });
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-1 text-[13px] text-rift-400">
      {api
        ? phones.filter(d => d.appVersion).map(d => <p key={d.id}>{d.name} : v{d.appVersion} {tx('(vu le')} {day(d.lastSync)})</p>)
        : s.pcVersion && <p>{tx('PC : v')}{s.pcVersion.version} {tx('(vu le')} {day(s.pcVersion.at)})</p>}
      <button onClick={report} disabled={busy} className="inline-flex items-center gap-1.5 text-gold-400 hover:text-gold-300 min-h-[36px] mr-4">
        <FileText size={14} /> {busy ? tx('Création du rapport…') : tx('Créer un rapport')}
      </button>
      {notes && (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-gold-400 hover:text-gold-300 min-h-[36px]">
          <Sparkles size={14} /> {tx('Nouveautés de cette version')}
        </button>
      )}
      {notes && (
        <Sheet open={open} title={tx('Nouveautés')} onClose={() => setOpen(false)}>
          <div className="space-y-4 pb-2">
            <p className="text-[13px] text-rift-400">{tx('Version')} {notes.title}</p>
            <WhatsNewList notes={notes} />
          </div>
        </Sheet>
      )}
    </div>
  );
}
