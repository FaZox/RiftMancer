import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ListChecks, ShieldCheck, ShieldAlert } from 'lucide-react';
import { usePrefs } from '../../lib/uiPrefs.js';
import { onRequest } from '../../lib/navRequest.js';
import { isDesktop } from '../../lib/collectionDB.js';
import { getSyncState } from '../../lib/syncClient.js';
import { shouldWelcome } from '../../lib/welcome.js';
import { tx, getLang, setLang, LANGUAGES as APP_LANGUAGES } from '../../lib/i18n.js';

/**
 * First launch (lot 6 g, B.6.9; mockups tel-10 to tel-12, pc-12). Phone: three
 * screens — scan, nothing added without you, keep your data safe (pair with
 * the PC, later, or demo data). PC: one window with the pairing QR code and
 * the Windows firewall explanation. « Passer » / « Plus tard » close it;
 * Réglages → Aide → « Revoir la présentation » shows it again.
 */
const SCAN_ICON = (
  <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16" />
  </svg>
);
const STEPS = [
  { icon: SCAN_ICON, title: tx('Scannez vos cartes'), text: tx('Cadrez la carte, l’appli la reconnaît. En cas de doute, elle vous demande.') },
  { icon: <ListChecks size={56} strokeWidth={1.8} aria-hidden="true" />, title: tx('Rien n’est ajouté sans vous'), text: tx('Les cartes scannées attendent dans la liste « À ajouter ». Vous validez quand vous voulez.') },
  { icon: <ShieldCheck size={56} strokeWidth={1.8} aria-hidden="true" />, title: tx('Gardez vos données en sécurité'), text: tx('L’appli sauvegarde seule sur le téléphone. Avec l’appli PC, vous synchronisez et faites vos decks sur grand écran.') },
];

async function loadDemo() {
  const { loadDemoData } = await import('../../lib/demoData.js');
  await loadDemoData();
}

function Hex({ children }) {
  return (
    <span className="hexagon w-[120px] h-[134px] flex items-center justify-center text-gold-400" style={{ background: 'rgba(200,168,78,.14)' }}>
      {children}
    </span>
  );
}

function PhoneWelcome({ onDone, onPair }) {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div role="dialog" aria-modal="true" aria-label={tx('Présentation')} className="fixed inset-0 z-[80] bg-rift-900 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-end px-4 py-3">
        <button onClick={onDone} className="min-h-[44px] px-2 text-[15px] text-rift-400">{tx('Passer')}</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8" key={i}>
        <Hex>{s.icon}</Hex>
        <h1 className="h-title text-[22px] mt-6">{s.title}</h1>
        <p className="text-[15px] text-rift-300 mt-3 max-w-[320px]">{s.text}</p>
      </div>
      <div className="px-6 pb-7">
        <div className="flex gap-2.5 justify-center" aria-label={tx('Écran {v0} sur {length}', { v0: i + 1, length: STEPS.length })}>
          {STEPS.map((_, k) => <i key={k} className={`w-2 h-2 rotate-45 ${k === i ? 'bg-gold-400' : 'bg-rift-600'}`} />)}
        </div>
        <div className="flex flex-col gap-3 mt-6">
          {!last ? (
            <button onClick={() => setI(i + 1)} className="btn-primary w-full text-[15px] py-3">{tx('Continuer')}</button>
          ) : (
            <>
              <button onClick={onPair} className="btn-primary w-full text-[15px] py-3">{tx('Appairer avec mon PC')}</button>
              <button onClick={onDone} className="btn-secondary w-full text-[15px] py-3">{tx('Plus tard')}</button>
              <button onClick={async () => { await loadDemo(); onDone(); }} className="text-[14px] text-gold-400 underline underline-offset-4 min-h-[40px]">{tx('Essayer avec des données de démonstration')}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PcWelcome({ onDone }) {
  const api = window.riftboundDesktop;
  const [qr, setQr] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const info = await api.sync.info();
      await api.sync.openPairing?.(); // pairing accepted while the QR code is shown
      const code = JSON.stringify({ t: 'riftbound-pair', v: 2, id: info.pcId, n: info.name, p: info.port, h: info.ips, k: info.token });
      const url = await QRCode.toDataURL(code, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
      if (alive) setQr(url);
    })().catch(() => {});
    const t = setInterval(() => api.sync.openPairing?.(), 4 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [api]);
  return (
    <div className="fixed inset-0 z-[80] bg-rift-900/80 flex items-center justify-center p-6">
      <div role="dialog" aria-modal="true" aria-label={tx('Bienvenue')} className="w-[820px] max-w-full bg-rift-800 border border-gold-500/40 p-8 flex gap-8">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex justify-center gap-1" role="group" aria-label="Language · Langue">
            {APP_LANGUAGES.map(([id, name]) => (
              <button key={id} onClick={() => { if (id !== getLang()) setLang(id); }} aria-pressed={getLang() === id} className={`chip px-3 h-9 text-sm ${getLang() === id ? 'text-gold-400 border-gold-500/60' : ''}`}>{name}</button>
            ))}
          </div>
          <h1 className="h-title text-[26px] leading-tight">{tx('Bienvenue dans RiftMancer')}</h1>
          <p className="text-[15px] text-rift-300">{tx('Vos decks et votre collection sur grand écran. Scannez vos cartes avec le téléphone, puis synchronisez-les ici.')}</p>
          <h2 className="text-[16px] font-semibold text-rift-100 pt-2">{tx('Appairer le téléphone')}</h2>
          <p className="text-[14px] text-rift-300">{tx('Dans l’appli du téléphone : Plus → Réglages → Synchronisation → « Scanner le QR code du PC ».')}</p>
          <p className="flex gap-2 text-[14px] text-rift-200 border border-state-warn/40 bg-state-warn/10 p-3">
            <ShieldAlert size={18} className="text-state-warn flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{tx('Si Windows demande d’autoriser l’appli sur le réseau, cochez')} <strong>{tx('Réseaux privés')}</strong>.</span>
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button onClick={onDone} className="btn-secondary text-[14px] py-2 px-4">{tx('Plus tard')}</button>
            <button onClick={async () => { await loadDemo(); onDone(); }} className="text-[14px] text-gold-400 underline underline-offset-4">{tx('Essayer avec des données de démonstration')}</button>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center">
          {qr ? <img src={qr} alt={tx('QR code d’appairage')} className="w-[220px] h-[220px] bg-white p-2" /> : <div className="w-[220px] h-[220px] bg-rift-700" />}
        </div>
      </div>
    </div>
  );
}

/**
 * Shown at the first launch of a new install, never to someone who already
 * has cards (an update); again on request (Réglages → Aide).
 * `copies`: exemplaires in the collection; `onPair`: phone → Synchronisation.
 */
export default function Welcome({ copies = 0, pending = 0, onPair }) {
  const [prefs, setPrefs] = usePrefs();
  const [open, setOpen] = useState(false);
  useEffect(() => onRequest((r) => { if (r.kind === 'welcome') setOpen(true); }), []);
  useEffect(() => {
    if (prefs.onboardingDone) return;
    (async () => {
      let paired = false;
      if (isDesktop) { try { paired = ((await window.riftboundDesktop.sync.info()).devices || []).length > 0; } catch { /* ignore */ } } else paired = getSyncState().paired;
      if (shouldWelcome({ done: prefs.onboardingDone, copies, pending, paired })) setOpen(true);
      else setPrefs({ onboardingDone: true });
    })();
  }, [prefs.onboardingDone, copies, pending, setPrefs]);
  const done = () => { setOpen(false); setPrefs({ onboardingDone: true }); };
  if (!open) return null;
  return isDesktop ? <PcWelcome onDone={done} /> : <PhoneWelcome onDone={done} onPair={() => { done(); onPair?.(); }} />;
}
