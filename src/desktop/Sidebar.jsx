import { requestHelp } from '../lib/help.js';
import React, { useEffect, useState } from 'react';
import { useContentNotices } from '../lib/contentNotices.js';
import { APP_VERSION } from '../lib/appVersion.js';
import {
  GalleryVerticalEnd, LayoutGrid, Swords, ScanLine, BarChart3, Package, UserCheck, ArrowLeftRight, Settings, Trophy, Search, HelpCircle,
} from 'lucide-react';
import { tx } from '../lib/i18n.js';

// B.3: five groups — what you own, what you play, adding cards, storing them.
const GROUPS = [
  { title: tx('Explorer'), items: [
    { id: 'cards', label: tx('Cartes'), icon: GalleryVerticalEnd },
  ] },
  { title: tx('Ma collection'), items: [
    { id: 'collection', label: tx('Collection'), icon: LayoutGrid },
    { id: 'value', label: tx('Valeur'), icon: BarChart3 },
  ] },
  { title: tx('Jouer'), items: [
    { id: 'decks', label: tx('Decks'), icon: Swords },
    { id: 'matches', label: tx('Matchs'), icon: Trophy },
  ] },
  { title: tx('Ajouter'), items: [
    { id: 'scan', label: tx('Scanner'), icon: ScanLine },
  ] },
  { title: tx('Organiser'), items: [
    { id: 'boxes', label: tx('Boîtes'), icon: Package },
    { id: 'loans', label: tx('Prêts'), icon: UserCheck },
    { id: 'trades', label: tx('Échanges et amis'), icon: ArrowLeftRight },
  ] },
];

/** PC navigation: always visible on the left, every section one click away. */
export default function Sidebar({ page, onChange, counts = {}, onSettings = () => onChange('settings'), onSearch }) {
  const Item = ({ id, label, icon: Icon }) => {
    const active = page === id;
    return (
      <button onClick={() => onChange(id)} aria-current={active ? 'page' : undefined}
        className={`relative w-full h-11 flex items-center gap-3 px-4 text-[15px] transition-colors ${
          active ? 'bg-gold-500/10 text-gold-400 font-bold' : 'text-rift-300 hover:bg-rift-800 hover:text-rift-100'
        }`}>
        {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-gold-400" />}
        <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
        <span className="flex-1 text-left">{label}</span>
        {counts[id] > 0 && (
          <span className="min-w-[26px] h-5 px-1.5 bg-gold-500 text-rift-900 text-[11px] font-bold flex items-center justify-center">
            {counts[id] > 9999 ? '9999+' : counts[id]}
          </span>
        )}
      </button>
    );
  };
  return (
    <nav aria-label={tx('Navigation principale')} className="w-[200px] 2xl:w-[210px] flex-shrink-0 flex flex-col bg-[#080b13] border-r border-gold-500/25">
      <div className="flex items-center gap-3 px-4 h-[84px] border-b border-gold-500/15">
        <img src="/icon.svg" alt="" className="w-10 h-10" />
        <span className="font-display font-bold text-gold-400 text-[18px] leading-tight tracking-wide">
          {tx('RiftMancer')}
        </span>
      </div>
      {onSearch && (
        <button onClick={onSearch} className="mx-4 mt-3 h-10 flex items-center gap-2 px-3 border border-rift-600 bg-rift-800/60 text-left text-[14px] text-rift-400 hover:border-gold-500/50">
          <Search className="w-4 h-4" aria-hidden="true" />
          <span className="flex-1">{tx('Rechercher…')}</span>
          <kbd className="font-mono text-[11px] text-rift-500">{tx('Ctrl K')}</kbd>
        </button>
      )}
      <div className="flex-1 overflow-y-auto py-4 space-y-5">
        {GROUPS.map(g => (
          <div key={g.title}>
            <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-rift-500">{g.title}</p>
            {g.items.map(i => <Item key={i.id} {...i} />)}
          </div>
        ))}
      </div>
      <div className="border-t border-gold-500/15 py-2">
        {/* Help on this screen: a label under every button (src/lib/help.js) */}
        <button onClick={() => requestHelp('mode')} className="w-full flex items-center gap-3 px-4 h-10 text-[15px] text-rift-300 hover:text-gold-400 hover:bg-rift-800/60">
          <HelpCircle className="w-5 h-5" aria-hidden="true" /> {tx('Aide sur cet écran')}
        </button>
        <Item id="settings" label={tx('Réglages')} icon={Settings} />
      </div>
      <StatusZone onSettings={onSettings} />
    </nav>
  );
}

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return tx('à l’instant');
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} jour${d > 1 ? 's' : ''}`;
};

/**
 * Status zone (B.3), at the bottom of the column: 3 lines of 13 px at most,
 * each clickable — the phone's last sync, content waiting (only when there is
 * something to do), the version.
 */
function StatusZone({ onSettings }) {
  const notices = useContentNotices();
  const [devices, setDevices] = useState([]);
  useEffect(() => {
    const api = window.riftboundDesktop;
    if (!api) return undefined;
    const load = () => api.sync.info().then(i => setDevices(i.devices || [])).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    const off = api.sync.onDevicesChanged?.(load);
    return () => { clearInterval(t); off?.(); };
  }, []);
  const last = Math.max(0, ...devices.map(d => d.lastSync || 0));
  const fresh = last && Date.now() - last < 7 * 24 * 3600e3;
  const phone = !devices.length ? tx('Téléphone : pas encore appairé') : last ? tx('Téléphone : synchronisé {ago}', { ago: ago(last) }) : tx('Téléphone : appairé, jamais synchronisé');
  const waiting = notices.cartes
    ? (notices.cartes.added ? `${notices.cartes.added} nouvelle${notices.cartes.added > 1 ? 's' : ''} carte${notices.cartes.added > 1 ? 's' : ''} disponible${notices.cartes.added > 1 ? 's' : ''}` : tx('Cartes à mettre à jour'))
    : notices.traductions ? `${notices.traductions.count} traduction${notices.traductions.count > 1 ? 's' : ''} disponible${notices.traductions.count > 1 ? 's' : ''}` : null;
  const line = 'w-full flex items-center gap-2 px-4 py-1 text-left text-[13px] hover:bg-rift-800';
  return (
    <div className="border-t border-gold-500/15 py-2" aria-label={tx('État')}>
      <button onClick={() => onSettings('sync')} className={`${line} text-rift-300`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${fresh ? 'bg-state-ok' : 'bg-state-warn'}`} aria-hidden="true" />
        <span className="truncate">{phone}</span>
      </button>
      {waiting && (
        <button onClick={() => onSettings('content')} className={`${line} text-gold-400 font-semibold`}>
          <span className="w-2 h-2 rotate-45 bg-gold-400 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{waiting}</span>
        </button>
      )}
      <button onClick={() => onSettings('about')} className={`${line} font-mono text-[11px] text-rift-500`}>v{APP_VERSION}</button>
    </div>
  );
}
