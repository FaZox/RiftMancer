import React, { useEffect, useState } from 'react';
import { FileText, Keyboard } from 'lucide-react';
import ShortcutsDialog from '../common/ShortcutsDialog.jsx';
import { requestOpen } from '../../lib/navRequest.js';
import { Field } from '../common/SectionCard.jsx';
import { useDialog } from '../common/Dialog.jsx';
import SyncSection from './SyncSection.jsx';
import BackupsSection, { backupDate } from './BackupsSection.jsx';
import ContentSection from './ContentSection.jsx';
import DemoSection from './DemoSection.jsx';
import AboutVersions from './AboutVersions.jsx';
import { AnimationsSection, CardmarketSection, PriceRefSection, LearningSection } from './PrefsSections.jsx';
import { RecognitionSection, LicencesLink } from './RecognitionSection.jsx';
import { DevSection, VersionTapper } from '../bench/DevMode.jsx';
import { CONDITIONS, LANGUAGES } from '../../data/sampleCards.js';
import { resetBatchDefaults } from '../../lib/batchDefaults.js';
import { useDisplayFrench } from '../../lib/cardLocale.js';
import { usePrefs } from '../../lib/uiPrefs.js';
import { ALERT_PCTS, ALERT_MINS, alertStatus } from '../../lib/priceMoves.js';
import { playScanSound, SOUND_LABELS, VOLUMES } from '../../lib/scanSounds.js';
import { isDesktop } from '../../lib/collectionDB.js';
import { getSyncState, subscribeSync } from '../../lib/syncClient.js';
import { listBackups } from '../../lib/localBackup.js';
import { useContentNotices } from '../../lib/contentNotices.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { deckFormats } from '../../lib/deckRules.js';
import { GAME } from '../../lib/probability.js';
import { APP_VERSION } from '../../lib/appVersion.js';
import { COUNTER_TARGET_KEY } from '../matches/ScoreCounter.jsx';
import { tx, getLang, setLang, LANGUAGES as APP_LANGUAGES } from '../../lib/i18n.js';

/**
 * Réglages (B.4): the same nine sections on the PC and the phone, from what
 * protects the data to what is accessory; « Développeur » tenth, in developer
 * mode only. Each has a one-line status (phone list, PC menu).
 */
export { SECTIONS, DEV_SECTION } from './sectionList.js';

const PRICE_LABEL = { trend: tx('Tendance'), avg7: tx('Moyenne 7 jours'), low: tx('Prix bas') };
const ago = (t) => {
  if (!t) return null;
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return tx('à l’instant');
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return backupDate(t).toLowerCase();
};

/** Status line of each section (B.4 table). */
export function useSectionStatus() {
  const [prefs] = usePrefs();
  const [allFrench] = useDisplayFrench();
  const notices = useContentNotices();
  const [s, setS] = useState(getSyncState);
  const [pc, setPc] = useState(null);
  const [lastPhoneBackup, setLastPhoneBackup] = useState(null);
  useEffect(() => {
    if (isDesktop) { window.riftboundDesktop.sync.info().then(setPc).catch(() => {}); return undefined; }
    listBackups().then(l => setLastPhoneBackup(l[0]?.at || null)).catch(() => {});
    return subscribeSync(setS);
  }, []);
  const m = getMatcher();
  const ai = m.ai?.state;
  const sync = isDesktop
    ? (pc?.devices?.length ? `${pc.devices[0].name}${pc.devices[0].lastSync ? ` · ${ago(pc.devices[0].lastSync)}` : ''}` : tx('Aucun téléphone appairé'))
    : s.paired ? `${s.pcName || 'PC'}${s.lastSync ? ` · ${ago(s.lastSync)}` : ''}` : tx('Pas encore appairé');
  const lastBackup = isDesktop ? pc?.lastBackup : lastPhoneBackup;
  const content = isDesktop
    ? (notices.cartes ? (notices.cartes.added ? `${notices.cartes.added} nouvelles cartes` : tx('Cartes à mettre à jour')) : notices.traductions ? tx('Traductions disponibles') : tx('À jour'))
    : (m.catalogInfo?.source === 'downloaded' ? tx('Reçu du PC') : tx('D’origine'));
  return {
    sync,
    backup: lastBackup ? tx('Dernière : {toLowerCase}', { toLowerCase: backupDate(lastBackup).toLowerCase() }) : tx('Aucune pour l’instant'),
    content,
    scan: prefs.recognition === 'grid16' ? tx('Couleurs seules') : ai === 'ready' ? tx('IA active') : ai === 'error' ? tx('IA indisponible') : ai === 'loading' ? tx('IA en démarrage') : 'IA',
    price: `${PRICE_LABEL[prefs.priceRef] || 'Tendance'} · ${alertStatus(prefs)}`,
    display: [allFrench ? tx('Tout en français') : tx('Langue des cartes'), prefs.textSize === 'large' ? 'texte grand' : null].filter(Boolean).join(' · '),
    game: deckFormats().find(f => f.id === (prefs.gameFormat || 'standard'))?.label || 'Standard',
    help: tx('Présentation, rapport'),
    about: `v${APP_VERSION}`,
    dev: tx('Collecte banc d’essai'),
  };
}

function Choice({ options, value, onChange, label }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`min-h-[40px] px-4 text-[14px] border ${value === v ? 'bg-gold-500/15 border-gold-500/60 text-gold-400 font-semibold' : 'border-rift-600 text-rift-300 hover:text-rift-100'}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Scan sounds (lot 8.2): off by default, on top of the vibrations. */
function ScanSoundsSection() {
  const [prefs, setPrefs] = usePrefs();
  return (
    <div>
      <h3 className="text-[15px] font-semibold text-rift-100 mt-2">{tx('Sons')}</h3>
      <Field label={tx('Sons du scan')} help={tx('Un son court et discret selon le résultat, en plus des vibrations. Le haut-parleur du scanner les coupe d’un geste.')}>
        <label className="flex items-center gap-3 text-[15px] text-rift-100 cursor-pointer min-h-[40px]">
          <input type="checkbox" checked={!!prefs.scanSounds} onChange={e => setPrefs({ scanSounds: e.target.checked })} className="w-4 h-4 accent-[#c8aa6e]" />
          {tx('Jouer un son après chaque scan')}
        </label>
      </Field>
      <Field label={tx('Volume')}>
        <Choice label={tx('Volume')} options={VOLUMES} value={VOLUMES.find(v => v[0] === prefs.scanVolume)?.[0] ?? 0.5} onChange={v => { setPrefs({ scanVolume: v }); playScanSound('success', { force: true }); }} />
      </Field>
      <Field label={tx('Écouter')}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SOUND_LABELS).map(([k, l]) => (
            <button key={k} onClick={() => playScanSound(k, { force: true })} className="btn-ghost min-h-[40px] px-3 text-[14px] border border-rift-600">{l}</button>
          ))}
        </div>
      </Field>
    </div>
  );
}

/** Alerts on the cards you own (lot 9, B.6.6): ±X % over 7 days, cards worth more than Y €. */
function PriceAlertsSection() {
  const [prefs, setPrefs] = usePrefs();
  const sel = 'bg-rift-700 border border-rift-500 text-rift-100 text-[15px] min-h-[40px] px-2 mx-1 align-middle';
  const n = (v) => String(v).replace('.', ',');
  return (
    <div className="space-y-2">
      <h3 className="text-[15px] font-semibold text-rift-100">{tx('Alertes sur mes cartes')}</h3>
      <label className="flex items-center gap-3 text-[15px] text-rift-100 cursor-pointer min-h-[40px]">
        <input type="checkbox" checked={prefs.priceAlertPct > 0} onChange={e => setPrefs({ priceAlertPct: e.target.checked ? 20 : 0 })} className="w-4 h-4 accent-[#c8aa6e]" />
        {tx('Me prévenir des fortes variations')}
      </label>
      {prefs.priceAlertPct > 0 && (
        <p className="text-[15px] leading-[2.6] text-rift-200">
          {tx('Me prévenir quand une de mes cartes bouge de plus de')}
          <select aria-label={tx('Variation')} value={prefs.priceAlertPct} onChange={e => setPrefs({ priceAlertPct: Number(e.target.value) })} className={sel}>
            {ALERT_PCTS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          {tx('% en 7 jours, pour les cartes de plus de')}
          <select aria-label={tx('Valeur minimale')} value={prefs.priceAlertMin} onChange={e => setPrefs({ priceAlertMin: Number(e.target.value) })} className={sel}>
            {ALERT_MINS.map(v => <option key={v} value={v}>{n(v)}</option>)}
          </select>
          €.
        </p>
      )}
      <p className="text-[13px] text-rift-400">{tx('Calculé seulement sur l’historique des prix gardé par l’appli : une carte n’est signalée qu’après 7 jours de prix. Les alertes de vos souhaits (prix d’alerte de chaque carte) restent actives. Un résumé s’affiche après chaque mise à jour des prix ; le détail est en tête de Valeur.')}</p>
    </div>
  );
}

/** Values given to the cards just scanned (Scanner section). */
function CardsDefaults({ batchDefaults, onUpdateDefaults }) {
  const set = (k, v) => onUpdateDefaults({ ...batchDefaults, [k]: v });
  return (
    <div>
      <h3 className="text-[15px] font-semibold text-rift-100 mt-2">{tx('Cartes scannées')}</h3>
      <p className="text-[13px] text-rift-400">{tx('Appliqué aux nouvelles cartes scannées (modifiable ensuite carte par carte).')}</p>
      <Field label={tx('État')} help={tx('État physique par défaut.')}>
        <Choice label={tx('État')} options={CONDITIONS.map(c => [c.value, c.label])} value={batchDefaults.condition} onChange={v => set('condition', v)} />
      </Field>
      <Field label={tx('Langue')} help={tx('Langue imprimée sur vos cartes.')}>
        <Choice label={tx('Langue')} options={LANGUAGES.map(l => [l.value, l.label])} value={batchDefaults.language} onChange={v => set('language', v)} />
      </Field>
      <Field label={tx('Foil')} help={tx('Une photo ne montre pas si une carte est foil : à indiquer vous-même. Les cartes uniquement foil le sont toujours.')}>
        <Choice label={tx('Foil')} options={[[false, tx('Non foil')], [true, tx('Foil')]]} value={!!batchDefaults.foil} onChange={v => set('foil', v)} />
      </Field>
      <button onClick={() => onUpdateDefaults(resetBatchDefaults(batchDefaults))} className="btn-ghost min-h-[40px] px-4 text-[14px] mt-3">{tx('Rétablir les valeurs par défaut')}</button>
    </div>
  );
}

function DisplaySection() {
  const [allFrench, setAllFrench] = useDisplayFrench();
  const [prefs, setPrefs] = usePrefs();
  return (
    <div>
      {/* Language of the app (i18n.js): both names shown, readable whatever the current language */}
      <Field label="Language · Langue" help={tx('Les noms et textes des cartes suivent la langue de l’appli. L’appli redémarre.')}>
        <Choice label="Language · Langue" options={APP_LANGUAGES} value={getLang()} onChange={v => { if (v !== getLang()) setLang(v); }} />
      </Field>
      <Field label={tx('Langue des cartes')} help={tx('La langue réelle de chaque exemplaire est conservée.')}>
        <label className="flex items-center gap-3 text-[15px] text-rift-100 cursor-pointer min-h-[40px]">
          <input type="checkbox" checked={allFrench} onChange={e => setAllFrench(e.target.checked)} className="w-4 h-4 accent-[#c8aa6e]" />
          {tx('Afficher toutes les cartes en français')}
        </label>
      </Field>
      <Field label={tx('Taille du texte')} help={tx('Agrandit tous les textes de l’appli.')}>
        <Choice label={tx('Taille du texte')} options={[['normal', tx('Normal')], ['large', tx('Grand')]]} value={prefs.textSize || 'normal'} onChange={v => setPrefs({ textSize: v })} />
      </Field>
      <div className="pt-3"><AnimationsSection bare /></div>
    </div>
  );
}

function GameSection() {
  const [prefs, setPrefs] = usePrefs();
  const [target, setTarget] = useState(() => { try { return Number(localStorage.getItem(COUNTER_TARGET_KEY)) || GAME.victoryScore; } catch { return GAME.victoryScore; } });
  const saveTarget = (v) => { const n = Math.max(1, Math.min(30, v)); setTarget(n); try { localStorage.setItem(COUNTER_TARGET_KEY, String(n)); } catch { /* ignore */ } };
  return (
    <div>
      <Field label={tx('Format par défaut')} help={tx('Celui des nouveaux decks (modifiable sur chaque deck).')}>
        <Choice label={tx('Format par défaut')} options={deckFormats().map(f => [f.id, f.label])} value={prefs.gameFormat || 'standard'} onChange={v => setPrefs({ gameFormat: v })} />
      </Field>
      <Field label={tx('Objectif de points')} help={tx('Compteur de points : {victoryScore} en 1v1 selon les règles officielles (11 en 2v2).', { victoryScore: GAME.victoryScore })}>
        <div className="flex items-center gap-2">
          <button onClick={() => saveTarget(target - 1)} aria-label={tx('Un point de moins')} className="btn-ghost min-h-[40px] min-w-[40px]">−</button>
          <span className="min-w-[3ch] text-center text-[17px] font-semibold text-rift-100" aria-live="polite">{target}</span>
          <button onClick={() => saveTarget(target + 1)} aria-label={tx('Un point de plus')} className="btn-ghost min-h-[40px] min-w-[40px]">+</button>
        </div>
      </Field>
      <Field label={tx('Main de départ')} help={tx('Règle officielle, utilisée par la simulation de main des decks.')}>
        <p className="text-[15px] text-rift-100 min-h-[40px] flex items-center">{GAME.handSize} {tx('cartes · mulligan de')} {GAME.mulliganMax} {tx('cartes au plus')}</p>
      </Field>
    </div>
  );
}

function HelpSection() {
  const { inform } = useDialog();
  const [busy, setBusy] = useState(false);
  const [keys, setKeys] = useState(false);
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
    <div className="space-y-4">
      <Field label={tx('Présentation')} help={tx('Les écrans du premier lancement : scanner, valider, sauvegarder et appairer.')}>
        <button onClick={() => requestOpen({ kind: 'welcome' })} className="btn-ghost min-h-[40px] px-4 text-[14px]">{tx('Revoir la présentation')}</button>
      </Field>
      <Field label={tx('Un problème ?')} help={tx('Un fichier à envoyer à la personne qui vous aide : versions, réglages, dernières erreurs. Aucune carte, aucun nom, aucun mot de passe.')}>
        <button onClick={report} disabled={busy} className="btn-secondary min-h-[40px] px-4 text-[14px]"><FileText className="w-4 h-4" /> {busy ? tx('Création…') : tx('Créer un rapport')}</button>
      </Field>
      {isDesktop && (
        <Field label={tx('Raccourcis clavier')} help={tx('Aussi avec la touche « ? » n’importe où dans l’appli.')}>
          <button onClick={() => setKeys(true)} className="btn-ghost min-h-[40px] px-4 text-[14px]"><Keyboard className="w-4 h-4" /> {tx('Voir les raccourcis')}</button>
        </Field>
      )}
      {keys && <ShortcutsDialog onClose={() => setKeys(false)} />}
      <DemoSection />
    </div>
  );
}

// Credits (LICENCE-ET-PUBLICATION.md 1.2 and 1.3): original project, Riot Games' policy (official English text below the French)
const ORIGIN_URL = 'https://github.com/Nekoraru22/riftbound-scanner';
const RIOT_EN = tx('RiftMancer was created under Riot Games\' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.');

function AboutSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <img src="/icon-192.png" alt="" className="w-14 h-14" />
        <div>
          <p className="font-display text-xl font-bold text-gold-400">{tx('RiftMancer')}</p>
          <VersionTapper className="text-[13px] text-rift-400" />
        </div>
      </div>
      <AboutVersions />
      <p className="text-[14px] text-rift-300 leading-relaxed">
        {tx('Scanner et gestionnaire de collection Riftbound : reconnaissance des cartes par intelligence artificielle, decks, prix Cardmarket, synchronisation téléphone ↔ PC.')}
      </p>
      <p className="text-[14px] text-rift-300 leading-relaxed">
        {tx('Basé sur')}{' '}
        <a href={ORIGIN_URL} target="_blank" rel="noreferrer" className="text-gold-400 underline underline-offset-2">{tx('riftbound-scanner')}</a>
        {' '}{tx('de Nekoraru22 (licence MIT), largement modifié et étendu.')}
      </p>
      <p className="text-[14px] text-rift-300 leading-relaxed">
        {tx('RiftMancer est un logiciel libre sous licence GNU AGPL-3.0 : vous pouvez le copier, le modifier et le redistribuer, à condition de partager le code source sous la même licence. Le code source est disponible auprès de l’auteur, et sur GitHub dès sa publication.')}
      </p>
      <div className="text-[13px] text-rift-400 p-3 border border-rift-600/50 bg-rift-800/40 space-y-2">
        <p className="font-semibold text-rift-300">{tx('Projet de fan gratuit et non commercial.')}</p>
        <p>{tx('RiftMancer a été créé selon la politique « Legal Jibber Jabber » de Riot Games en utilisant des éléments appartenant à Riot Games. Riot Games ne soutient ni ne sponsorise ce projet.')}</p>
        <p lang="en" className="text-rift-500">{RIOT_EN}</p>
      </div>
      <LicencesLink />
    </div>
  );
}

/** The content of section `id`. */
export function SectionContent({ id, batchDefaults, onUpdateDefaults }) {
  switch (id) {
    case 'sync': return <SyncSection />;
    case 'backup': return <BackupsSection />;
    case 'content': return <ContentSection />;
    case 'scan': return (
      <div className="space-y-6">
        <div><h3 className="text-[15px] font-semibold text-rift-100 mb-2">{tx('Moteur de reconnaissance')}</h3><RecognitionSection bare /></div>
        <div className="border-t border-rift-600/40 pt-4"><h3 className="text-[15px] font-semibold text-rift-100 mb-2">{tx('Apprentissage')}</h3><LearningSection bare /></div>
        <div className="border-t border-rift-600/40 pt-2"><ScanSoundsSection /></div>
        <div className="border-t border-rift-600/40 pt-2"><CardsDefaults batchDefaults={batchDefaults} onUpdateDefaults={onUpdateDefaults} /></div>
      </div>
    );
    case 'price': return (
      <div className="space-y-6">
        <div><h3 className="text-[15px] font-semibold text-rift-100 mb-2">{tx('Prix de référence')}</h3><PriceRefSection bare /></div>
        <div className="border-t border-rift-600/40 pt-4"><PriceAlertsSection /></div>
        <div className="border-t border-rift-600/40 pt-4"><h3 className="text-[15px] font-semibold text-rift-100 mb-2">{tx('Liens Cardmarket')}</h3><CardmarketSection bare /></div>
      </div>
    );
    case 'display': return <DisplaySection />;
    case 'game': return <GameSection />;
    case 'help': return <HelpSection />;
    case 'about': return <AboutSection />;
    case 'dev': return <DevSection bare />;
    default: return null;
  }
}
