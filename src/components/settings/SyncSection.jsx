import React, { useEffect, useState, useCallback } from 'react';
import { SyncLog } from './SyncHistory.jsx';
import { usePrefs } from '../../lib/uiPrefs.js';
import { REMINDER_DAYS } from '../../lib/syncReminder.js';
import Banner from '../common/Banner.jsx';
import { APP_VERSION } from '../../lib/appVersion.js';
import { phoneCompat, pcCompat } from '../../lib/versionCompat.js';
import { PROTO } from '../../lib/syncProtocol.js';
import QRCode from 'qrcode';
import { RefreshCw, Smartphone, Monitor, QrCode, Wifi, WifiOff, Unlink, KeyRound, Image as ImageIcon, Upload, Download, Send, Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { isDesktop } from '../../lib/collectionDB.js';
import {
  getSyncState, subscribeSync, syncNow, pair, unpair, setFullImages, searchPcOnNetwork,
} from '../../lib/syncClient.js';
import { isNative } from '../../lib/nativeAssets.js';
import QrScanner from './QrScanner.jsx';
import { useDialog } from '../common/Dialog.jsx';
import { tx, locale } from '../../lib/i18n.js';

function timeAgo(ts) {
  if (!ts) return 'jamais';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return tx('à l’instant');
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(ts).toLocaleDateString(locale());
}

const sectionClass = 'rounded-2xl bg-rift-800/60 border border-rift-600/20 p-5 space-y-4';

/** Settings section: phone ↔ PC synchronisation. */
export default function SyncSection() {
  return isDesktop ? <DesktopSync /> : <PhoneSync />;
}

// ─── PC side: show the pairing QR code and the paired phones ─────────────
function DesktopSync() {
  const { ask } = useDialog();
  const api = window.riftboundDesktop;
  const [info, setInfo] = useState(null);
  const [qr, setQr] = useState(null);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => setInfo(await api.sync.info()), [api]);

  useEffect(() => {
    refresh();
    const off = api.sync.onDevicesChanged(refresh);
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => { off(); clearInterval(t); };
  }, [api, refresh]);

  // Pairing is accepted only while this QR code is shown (5 min, renewed).
  useEffect(() => {
    api.sync.openPairing?.();
    const t = setInterval(() => api.sync.openPairing?.(), 4 * 60 * 1000);
    return () => clearInterval(t);
  }, [api]);

  const code = info && JSON.stringify({
    t: 'riftbound-pair', v: 2, id: info.pcId, n: info.name, p: info.port, h: info.ips, k: info.token,
  });

  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(code, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then(setQr);
  }, [code]);

  if (!info) return null;
  // A phone paired in the last 7 days: remind to renew the key if it was not ours.
  const recent = info.devices.filter(d => d.firstSync && Date.now() - d.firstSync < 7 * 24 * 3600 * 1000);

  return (
    <section className={sectionClass}>
      <h2 className="text-sm font-semibold text-rift-100 flex items-center gap-2">
        <Monitor className="w-4 h-4 text-gold-400" />
        {tx('Synchronisation avec le téléphone')}
      </h2>
      <label className="flex items-center justify-between gap-3 text-xs text-rift-200">
        <span>
          {tx('Autoriser la synchronisation sur le réseau')}
          <span className="block text-[11px] text-rift-500">{tx('Désactivé : le PC n’est plus joignable depuis le Wi-Fi (le téléphone ne pourra pas synchroniser).')}</span>
        </span>
        <input type="checkbox" checked={info.lanSync !== false} onChange={async (e) => setInfo(await api.sync.setLan(e.target.checked))} />
      </label>
      <p className="text-[11px] text-rift-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
        {tx('Échanges chiffrés, une clé par téléphone. Un téléphone ne peut s’appairer que pendant que ce QR code est affiché.')}
      </p>
      {recent.length > 0 && (
        <p className="text-[11px] text-amber-300 flex items-start gap-1.5 rounded-lg bg-amber-500/10 border border-amber-400/30 p-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            {tx('Appareil appairé récemment :')} {recent.map(d => d.name).join(', ')}{tx('. Si ce n’est pas le vôtre, cliquez sur « Dissocier » à côté de son nom (il est coupé aussitôt, vos autres téléphones continuent).')}
          </span>
        </p>
      )}
      <p className="text-xs text-rift-400">
        {tx('Dans l’application Android : Réglages → « Scanner le QR code du PC ». La synchronisation se lance depuis le téléphone (« Synchroniser maintenant »), uniquement quand vous le décidez. Les deux appareils doivent être sur le même Wi-Fi. Vos données ne quittent pas votre réseau.')}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
        {qr && <img src={qr} alt={tx('QR code d’appairage')} className="w-48 h-48 rounded-xl bg-white p-2" />}
        <div className="space-y-2 text-xs text-rift-300 w-full">
          <p><span className="text-rift-500">{tx('PC :')}</span> {info.name}</p>
          <p><span className="text-rift-500">{tx('Adresse')}{info.ips.length > 1 ? 's' : ''} :</span> {info.ips.length ? info.ips.map(ip => `${ip}:${info.port}`).join(', ') : tx('aucun réseau détecté')}</p>
          {info.devices.map(d => pcCompat({ myVersion: info.appVersion, phoneVersion: d.appVersion, phoneName: d.name })).filter(Boolean).map((c, i) => (
            <Banner key={i} tone={c.tone}>{c.text}</Banner>
          ))}
          <div>
            <p className="text-rift-500 mb-1">{tx('Téléphones appairés :')}</p>
            {info.devices.length === 0 ? (
              <p className="text-rift-400">{tx('Aucun pour l’instant')}</p>
            ) : info.devices.map(d => (
              <p key={d.id} className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-gold-400" />
                <span className="flex-1">{d.name}{d.appVersion ? ` (v${d.appVersion})` : ''} — {d.lastSync ? `synchro ${timeAgo(d.lastSync)}` : tx('appairé {timeAgo}', { timeAgo: timeAgo(d.pairedAt || d.firstSync) })}</span>
                <button
                  onClick={async () => {
                    if (!await ask({ title: tx('Dissocier « {name} » ?', { name: d.name }), message: tx('Sa clé est supprimée : il ne peut plus synchroniser avant d’avoir scanné à nouveau le QR code affiché sur ce PC. Les autres téléphones ne sont pas touchés.'), confirmLabel: tx('Dissocier'), destructive: true })) return;
                    setInfo(await api.sync.removeDevice(d.id));
                  }}
                  className="btn-ghost text-[11px] py-1 px-2 rounded-lg text-red-400"
                >
                  <Unlink className="w-3 h-3" /> {tx('Dissocier')}
                </button>
              </p>
            ))}
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(code)}
            className="btn-ghost text-xs py-1.5 px-3 rounded-xl"
          >
            {tx('Copier le code d’appairage')}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-amber-400/80">
        {tx('Si le téléphone ne trouve pas le PC : autorisez « RiftMancer » (ou Electron) pour les réseaux privés dans le pare-feu Windows.')}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={async () => {
            if (!await ask({ title: tx('Changer le QR code ?'), message: tx('Les QR codes déjà affichés ou photographiés ne marcheront plus. Les téléphones déjà appairés continuent (pour en couper un : « Dissocier »).'), confirmLabel: tx('Changer le QR code') })) return;
            setInfo(await api.sync.regenerateToken());
          }}
          className="btn-ghost text-xs py-2 px-3 rounded-xl"
        >
          <KeyRound className="w-3.5 h-3.5" /> {tx('Nouveau QR code')}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {info.phoneOffer ? (
          <>
            <span className="text-xs text-state-warn flex-1 min-w-[200px]">{tx('Envoi préparé : le téléphone affichera « Le PC veut vous envoyer ses données → Recevoir » à son ouverture.')}</span>
            <button onClick={async () => setInfo(await api.sync.offer(false))} className="btn-ghost text-xs py-2 px-3">{tx('Annuler l’envoi')}</button>
          </>
        ) : (
          <button onClick={async () => setInfo(await api.sync.offer(true))} className="btn-secondary text-xs py-2 px-3">
            <Send className="w-3.5 h-3.5" /> {tx('Envoyer sur le téléphone')}
          </button>
        )}
      </div>
      <p className="text-[11px] text-rift-500">
        {tx('Le PC ne peut pas joindre le téléphone de lui-même (Android ne le permet pas à une app) : « Envoyer sur le téléphone » prépare l’envoi, et vous le validez sur le téléphone. Rien n’est jamais synchronisé automatiquement.')}
      </p>
      <SyncLog refreshKey={info.devices.map(d => d.lastSync).join()} />
      <p className="text-[11px] text-rift-500">
        {tx('Sauvegardes : Réglages → Sauvegardes.')}{info.lastBackup ? tx(' Dernière : {timeAgo}.', { timeAgo: timeAgo(info.lastBackup) }) : ''}
      </p>
    </section>
  );
}

// ─── Phone side: pair, status, sync now ──────────────────────────────────
/**
 * The three manual sync directions. Nothing is ever synchronised
 * automatically: each button is one exchange, when you decide.
 */
export function SyncButtons({ s }) {
  const syncing = s.status === 'syncing';
  return (
    <div className="space-y-2">
      {s.pcOffer && (
        <div className="flex items-center gap-2 px-3 py-2 border border-state-warn/55 bg-state-warn/10 text-[13px] text-rift-100">
          <Download className="w-4 h-4 text-state-warn flex-shrink-0" />
          <span className="flex-1">{tx('Le PC veut vous envoyer ses données (')}{new Date(s.pcOffer).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}).</span>
          <button onClick={() => syncNow('pull')} disabled={syncing} className="btn-primary text-xs py-1.5 px-3">{tx('Recevoir')}</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => syncNow('push')} disabled={syncing} className="btn-secondary text-xs py-2 px-2">
          <Upload className="w-4 h-4" /> {tx('Envoyer sur le PC')}{s.pending ? ` (${s.pending})` : ''}
        </button>
        <button onClick={() => syncNow('pull')} disabled={syncing} className="btn-secondary text-xs py-2 px-2">
          <Download className="w-4 h-4" /> {tx('Recevoir du PC')}
        </button>
      </div>
      <button onClick={() => syncNow('both')} disabled={syncing} className="btn-primary w-full text-sm">
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {tx('Synchroniser les deux sens')}
      </button>
      <p className="text-[11px] text-rift-500">
        {tx('« Envoyer » : vos changements partent sur le PC, rien ne revient. « Recevoir » : vous récupérez ceux du PC, les vôtres restent en attente. Rien n’est jamais synchronisé automatiquement.')}
      </p>
      <ReminderSetting />
    </div>
  );
}

/** Lot 3.2: after how many days unsent changes are recalled on the Collection screen. */
function ReminderSetting() {
  const [prefs, setPrefs] = usePrefs();
  const days = prefs.syncReminderDays ?? 7;
  return (
    <div className="pt-1">
      <p className="text-[12px] text-rift-300 mb-1">{tx('Rappel quand des changements attendent depuis')}</p>
      <div className="seg" role="radiogroup" aria-label={tx('Rappel de synchro')}>
        {[...REMINDER_DAYS, 0].map(d => (
          <button key={d} role="radio" aria-checked={days === d} onClick={() => setPrefs({ syncReminderDays: d, syncReminderDismissedAt: null })}>
            {d ? `${d} j` : tx('Jamais')}
          </button>
        ))}
      </div>
    </div>
  );
}

function PhoneSync() {
  const { ask } = useDialog();
  const [s, setS] = useState(getSyncState());
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const off = subscribeSync(setS);
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => { off(); clearInterval(t); };
  }, []);

  const doPair = useCallback(async (text) => {
    setScanning(false);
    setBusy(true);
    setMessage(null);
    try {
      await pair(text);
      setMessage({ ok: true, text: tx('Appairé ! Appuyez sur « Synchroniser maintenant » quand vous voulez synchroniser.') });
      setManual('');
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }, []);

  const statusText = {
    idle: s.lastSync ? tx('Dernière synchro {timeAgo}', { timeAgo: timeAgo(s.lastSync) }) : tx('Jamais synchronisé'),
    syncing: 'Synchronisation…',
    ok: tx('Synchronisé {timeAgo}', { timeAgo: timeAgo(s.lastSync) }),
    offline: tx('PC injoignable — dernière synchro {timeAgo}', { timeAgo: timeAgo(s.lastSync) }),
    error: s.lastError || 'Erreur',
  }[s.status];

  return (
    <section className={sectionClass}>
      <h2 className="text-sm font-semibold text-rift-100 flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-gold-400" />
        {tx('Synchronisation avec le PC')}
      </h2>

      {!s.paired ? (
        <>
          <p className="text-xs text-rift-400">
            {tx('Ouvrez l’application PC, allez dans Réglages et scannez le QR code affiché. Ensuite, synchronisez quand vous le souhaitez, téléphone et PC sur le même Wi-Fi.')}
          </p>
          <button onClick={() => setScanning(true)} disabled={busy} className="btn-primary text-xs py-2 px-4 rounded-xl">
            <QrCode className="w-4 h-4" /> {busy ? tx('Connexion…') : tx('Scanner le QR code du PC')}
          </button>
          <details className="text-xs text-rift-400">
            <summary className="cursor-pointer">{tx('Ou coller le code d’appairage')}</summary>
            <textarea
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              rows={3}
              className="mt-2 w-full bg-rift-800/50 border border-rift-600/30 rounded-xl text-xs text-rift-100 p-2 focus:outline-none focus:border-gold-500/60"
              placeholder='{"t":"riftbound-pair",…}'
            />
            <button onClick={() => doPair(manual)} disabled={!manual.trim() || busy} className="btn-secondary text-xs py-1.5 px-3 rounded-xl mt-2">
              {tx('Appairer')}
            </button>
          </details>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs">
            {s.status === 'offline' || s.status === 'error'
              ? <WifiOff className="w-4 h-4 text-amber-400" />
              : <Wifi className="w-4 h-4 text-green-400" />}
            <span className="text-rift-200">{s.pcName}</span>
            <span className={s.status === 'error' ? 'text-red-400' : 'text-rift-400'}>· {statusText}</span>
          </div>
          <p className="text-[11px] text-rift-400">
            {s.pending > 0
              ? tx('{pending} modification{v1} à envoyer au PC.', { pending: s.pending, v1: s.pending > 1 ? 's' : '' })
              : tx('Aucune modification en attente.')}
            {' '}{tx('En cas de modification de la même carte sur les deux appareils, la plus récente est gardée.')}
          </p>
          {(() => {
            const c = s.status === 'error' && s.pcProto != null ? null : phoneCompat({ myProto: PROTO, pcProto: s.pcProto, myVersion: APP_VERSION, pcVersion: s.pcVersion?.version });
            return c && <Banner tone={c.tone}>{c.text}</Banner>;
          })()}
          {Math.abs(s.clockSkew || 0) > 2 * 60 * 1000 && (
            <p className="text-[11px] text-amber-300">
              {tx('⚠ L’heure du téléphone a')} {Math.round(Math.abs(s.clockSkew) / 60000)} {tx('min')} {s.clockSkew > 0 ? 'de retard' : tx('d’avance')} {tx('sur le PC. Les dates sont corrigées à la synchro, mais réglez l’heure automatique du téléphone.')}
            </p>
          )}
          {s.images && (
            <div className="space-y-1">
              <p className="text-[11px] text-rift-400 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> {tx('Images :')} {s.images.done} / {s.images.total}
              </p>
              <div className="h-1.5 rounded-full bg-rift-700 overflow-hidden">
                <div className="h-full bg-gold-400" style={{ width: `${(100 * s.images.done) / Math.max(1, s.images.total)}%` }} />
              </div>
            </div>
          )}
          {isNative && (
            <label className="flex items-center justify-between text-xs text-rift-300">
              <span>{tx('Télécharger les images en grand (≈130 Mo, pour le zoom)')}</span>
              <input type="checkbox" checked={s.fullImages} onChange={(e) => setFullImages(e.target.checked)} />
            </label>
          )}
          <SyncButtons s={s} />
          {s.status === 'offline' && (
            <div className="space-y-1">
              <p className="text-[11px] text-rift-400">
                {tx('Le PC a peut-être changé d’adresse. Vérifiez qu’il est allumé, l’application ouverte et la synchronisation réseau autorisée, puis lancez une recherche (quelques dizaines de secondes).')}
              </p>
              <button
                onClick={async () => {
                  setMessage(null);
                  const ok = await searchPcOnNetwork();
                  setMessage(ok ? { ok: true, text: tx('PC retrouvé ! Vous pouvez synchroniser.') } : { ok: false, text: tx('PC introuvable sur ce réseau.') });
                }}
                disabled={!!s.searching}
                className="btn-secondary text-xs py-2 px-3 rounded-xl"
              >
                <Search className="w-3.5 h-3.5" />
                {s.searching ? tx('Recherche… {done} / {total}', { done: s.searching.done, total: s.searching.total }) : tx('Rechercher le PC sur le réseau')}
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => { if (await ask({ title: tx('Dissocier ce téléphone du PC ?'), message: tx('Les cartes restent sur le téléphone.'), confirmLabel: tx('Dissocier'), destructive: true })) unpair(); }}
              className="btn-ghost text-xs py-2 px-3 rounded-xl text-red-400"
            >
              <Unlink className="w-3.5 h-3.5" /> {tx('Dissocier')}
            </button>
          </div>
        </>
      )}

      {message && <p className={`text-xs ${message.ok ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>}
      {s.paired && <SyncLog refreshKey={s.lastSync} />}
      {scanning && <QrScanner onResult={doPair} onClose={() => setScanning(false)} />}
    </section>
  );
}
