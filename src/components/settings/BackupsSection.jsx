import React, { useCallback, useEffect, useState } from 'react';
import { Archive, FolderOpen, RotateCcw, Save, Share2, Usb } from 'lucide-react';
import { SectionCard } from '../common/SectionCard.jsx';
import { useDialog } from '../common/Dialog.jsx';
import { isDesktop } from '../../lib/collectionDB.js';
import { AUTO_KEEP, REASON_LABEL } from '../../lib/autoBackup.js';
import { backupNow, exportAuto, listBackups, restoreAuto, publicCopyInfo, weeklyCopy, onPublicCopy, weeklyCopyAvailable } from '../../lib/localBackup.js';
import { usePrefs } from '../../lib/uiPrefs.js';
import Banner from '../common/Banner.jsx';
import LocalBackupSection from './LocalBackupSection.jsx';
import { tx, locale, getLang, tp } from '../../lib/i18n.js';

const PC_KEEP = 30; // electron/backups.cjs
const SHOWN = 8;

export const backupDate = (ts) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }).replace(':', getLang() === 'fr' ? ' h ' : ':');
  if (d.toDateString() === today.toDateString()) return tx('Aujourd’hui, {time}', { time });
  if (d.toDateString() === yesterday.toDateString()) return `Hier, ${time}`;
  return `${d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}, ${time}`;
};
const size = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString(locale(), { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);
const copiesText = (n) => (n == null ? '' : `${tp(n, '{n} exemplaire', '{n} exemplaires', { n: n.toLocaleString(locale()) })}`);

/** One line of the list (B.6.12): date, copies, size, « Restaurer » (and « Exporter » on the phone). */
function BackupRow({ b, onRestore, onExport, busy }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-b border-rift-700/60 last:border-0">
      <div className="flex-1 min-w-[150px]">
        <p className="text-[14px] text-rift-100">{backupDate(b.date ?? b.at)}</p>
        <p className="text-[12px] text-rift-400">
          {[copiesText(b.copies), size(b.size || 0), b.reason && b.reason !== 'quotidienne' ? REASON_LABEL[b.reason] : null].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {onExport && <button onClick={() => onExport(b)} disabled={busy} className="btn-ghost text-[13px] py-1.5 px-2"><Share2 className="w-3.5 h-3.5" /> {tx('Exporter')}</button>}
        <button onClick={() => onRestore(b)} disabled={busy} className="btn-secondary text-[13px] py-1.5 px-3"><RotateCcw className="w-3.5 h-3.5" /> {tx('Restaurer')}</button>
      </div>
    </li>
  );
}

function BackupList({ list, ...rest }) {
  const [all, setAll] = useState(false);
  if (!list) return <p className="text-[13px] text-rift-400">{tx('Chargement…')}</p>;
  if (!list.length) return <p className="text-[13px] text-rift-400">{tx('Aucune sauvegarde pour l’instant : la première est faite dès qu’il y a des cartes.')}</p>;
  const shown = all ? list : list.slice(0, SHOWN);
  return (
    <>
      <ul>{shown.map(b => <BackupRow key={b.name} b={b} {...rest} />)}</ul>
      {list.length > SHOWN && (
        <button onClick={() => setAll(a => !a)} className="text-[13px] text-gold-400 mt-1">{all ? tx('Afficher moins') : tx('Tout afficher ({length})', { length: list.length })}</button>
      )}
    </>
  );
}

const Msg = ({ msg }) => (msg ? <p role="status" className={`text-[13px] mt-2 break-all ${msg.ok ? 'text-state-ok' : 'text-state-bad'}`}>{msg.text}</p> : null);

const restoreMessage = (b, phone) => tx('Revenir à la sauvegarde du {toLowerCase}{v1} ?\n\nL’état actuel est d’abord sauvegardé : vous pourrez y revenir. {v2}', { toLowerCase: backupDate(b.date ?? b.at).toLowerCase(), v1: b.copies != null ? ` (${copiesText(b.copies)})` : '', v2: phone
  ? tx('Le PC recevra la collection restaurée à votre prochain envoi.')
  : tx('Le téléphone recevra la collection restaurée à sa prochaine synchro.') });

// ─── PC ──────────────────────────────────────────────────────────────────

function PcBackups() {
  const api = window.riftboundDesktop;
  const { ask } = useDialog();
  const [list, setList] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const [l, i] = await Promise.all([api.backup.list(), api.sync.info()]);
    setList(l);
    setInfo(i);
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (err) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };
  const restore = (b) => run(async () => {
    if (!await ask({ title: tx('Restaurer cette sauvegarde ?'), message: restoreMessage(b, false), confirmLabel: tx('Restaurer') })) return;
    const n = await api.backup.restore(b.name);
    setMsg({ ok: true, text: tx('Sauvegarde restaurée ({n} fiches).', { n }) });
    await load();
  });
  const extra = info?.extraBackup;

  return (
    <>
      <SectionCard icon={Archive} title={tx('Sauvegardes automatiques')} status={tx('{PC_KEEP} gardées', { PC_KEEP })}>
        <p className="text-[13px] text-rift-400 mb-1">{tx('À l’ouverture, après une synchro avec des changements et à la fermeture.')}</p>
        <BackupList list={list} onRestore={restore} busy={busy} />
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => run(async () => { await api.backup.now(); await load(); setMsg({ ok: true, text: tx('Sauvegarde faite.') }); })} disabled={busy} className="btn-primary text-[13px] py-2 px-3">
            <Save className="w-4 h-4" /> {tx('Sauvegarder maintenant')}
          </button>
          <button onClick={() => api.backup.openFolder()} className="btn-ghost text-[13px] py-2 px-3"><FolderOpen className="w-4 h-4" /> {tx('Ouvrir le dossier')}</button>
        </div>
        <Msg msg={msg} />
      </SectionCard>

      <SectionCard icon={Usb} title={tx('Dossier supplémentaire')}
        status={extra && (extra.ok
          ? <span className="text-state-ok font-semibold">{tx('Accessible')}</span>
          : <span className="text-state-warn font-semibold">{tx('Introuvable')}</span>)}>
        {extra ? (
          <>
            <p className="font-mono text-[13px] text-rift-100 break-all">{extra.dir}</p>
            <p className="text-[13px] text-rift-400 mt-1">
              {extra.ok
                ? tx('Chaque sauvegarde y est copiée aussi (les {PC_KEEP} dernières).', { PC_KEEP })
                : tx('Ce dossier n’est pas accessible (clé USB retirée ?). Les sauvegardes continuent sur ce PC.')}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-rift-400">
            {tx('Aucun. Une copie de chaque sauvegarde sur une clé USB ou un autre disque protège vos cartes si ce disque tombe en panne.')}
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => run(async () => { setInfo(await api.backup.chooseExtra()); })} disabled={busy} className="btn-secondary text-[13px] py-2 px-3">
            <FolderOpen className="w-4 h-4" /> {tx('Choisir un dossier…')}
          </button>
          {extra && (
            <button onClick={() => run(async () => {
              if (!await ask({ title: tx('Ne plus utiliser ce dossier ?'), message: tx('Les sauvegardes déjà copiées y restent ; les suivantes ne seront plus faites que sur ce PC.'), confirmLabel: tx('Ne plus utiliser') })) return;
              setInfo(await api.backup.clearExtra());
            })} disabled={busy} className="btn-ghost text-[13px] py-2 px-3">{tx('Ne plus utiliser')}</button>
          )}
        </div>
      </SectionCard>
    </>
  );
}

// ─── Phone ───────────────────────────────────────────────────────────────

function PhoneBackups() {
  const { ask } = useDialog();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = useCallback(async () => setList(await listBackups().catch(() => [])), []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (err) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };
  const restore = (b) => run(async () => {
    if (!await ask({ title: tx('Restaurer cette sauvegarde ?'), message: restoreMessage(b, true), confirmLabel: tx('Restaurer') })) return;
    await restoreAuto(b.name);
    setMsg({ ok: true, text: tx('Sauvegarde du {toLowerCase} restaurée.', { toLowerCase: backupDate(b.at).toLowerCase() }) });
    await load();
  });
  const doExport = (b) => run(async () => {
    const where = await exportAuto(b.name);
    setMsg({ ok: true, text: tx('Copiée dans {where}', { where }) });
  });

  return (
    <SectionCard icon={Archive} title={tx('Sauvegardes automatiques')} status={tx('{AUTO_KEEP} gardées', { AUTO_KEEP })}>
      <p className="text-[13px] text-rift-400 mb-1">{tx('Une par jour quand quelque chose a changé, et avant chaque mise à jour des données. Elles restent dans l’appli : « Exporter » en met une copie dans Documents.')}</p>
      <BackupList list={list} onRestore={restore} onExport={doExport} busy={busy} />
      <button onClick={() => run(async () => {
        const made = await backupNow();
        await load();
        setMsg(made ? { ok: true, text: tx('Sauvegarde faite.') } : { ok: false, text: tx('Rien à sauvegarder : la collection est vide.') });
      })} disabled={busy} className="btn-primary text-[13px] py-2 px-3 mt-3">
        <Save className="w-4 h-4" /> {tx('Sauvegarder maintenant')}
      </button>
      <Msg msg={msg} />
      {weeklyCopyAvailable() && <WeeklyCopy />}
    </SectionCard>
  );
}

/** Weekly copy in Documents/Riftbound (CORRECTIONS-v3 D), on by default. */
function WeeklyCopy() {
  const [prefs, setPrefs] = usePrefs();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => publicCopyInfo().then(setInfo).catch(() => {}), []);
  useEffect(() => { load(); return onPublicCopy(load); }, [load]);
  const on = prefs.weeklyDocCopy !== false;
  const now = async () => { setBusy(true); try { await weeklyCopy({ force: true }); await load(); } finally { setBusy(false); } };
  return (
    <div className="mt-4 pt-3 border-t border-rift-600/40 space-y-2">
      <label className="flex items-center gap-3 text-[15px] text-rift-100 cursor-pointer min-h-[40px]">
        <input type="checkbox" checked={on} onChange={e => setPrefs({ weeklyDocCopy: e.target.checked })} className="w-4 h-4 accent-[#c8aa6e]" />
        {tx('Copie hebdomadaire dans Documents/Riftbound')}
      </label>
      <p className="text-[13px] text-rift-400">{tx('Une fois par semaine si quelque chose a changé ; les 3 dernières sont gardées. Ce dossier reste sur le téléphone si vous désinstallez l’appli. D’autres applis peuvent le lire : les notes sur vos adversaires n’y sont pas copiées (elles restent dans les sauvegardes de l’appli et sur le PC).')}</p>
      {info?.okAt && <p className="text-[13px] text-rift-300">{tx('Dernière copie :')} {backupDate(info.okAt).toLowerCase()}{info.where ? ` · ${info.where}` : ''}</p>}
      {info?.error && (
        <Banner tone="bad" action={{ label: busy ? 'Copie…' : tx('Réessayer'), onClick: now }}>
          {tx('La copie dans Documents a échoué (')}{info.error}{tx('). Vos sauvegardes restent dans l’appli : synchronisez avec le PC ou utilisez « Exporter ».')}
        </Banner>
      )}
      {on && !info?.error && <button onClick={now} disabled={busy} className="btn-ghost text-[13px] py-1.5 px-3 border border-rift-600"><Share2 className="w-3.5 h-3.5" /> {busy ? tx('Copie…') : tx('Copier maintenant')}</button>}
    </div>
  );
}

/** Réglages → Sauvegardes (B.6.12): automatic backups, extra folder (PC), backup file. */
export default function BackupsSection() {
  return (
    <div className="space-y-4">
      {isDesktop ? <PcBackups /> : <PhoneBackups />}
      <LocalBackupSection />
    </div>
  );
}
