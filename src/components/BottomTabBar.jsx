import React from 'react';
import { LayoutGrid, Swords, ScanLine, GalleryVerticalEnd, MoreHorizontal, BarChart3, Package } from 'lucide-react';
import { useNeedsAttention } from '../lib/attention.js';
import { tx } from '../lib/i18n.js';

// Design Hextech : 5 onglets, le Scanner au centre (plus gros, atteignable au pouce).
// 7 onglets depuis l'onglet Cartes : Valeur à droite de Cartes, Boîtes à droite de Decks.
export const TABS = [
  { id: 'collection', label: tx('Collection'), icon: LayoutGrid },
  { id: 'cards', label: tx('Cartes'), icon: GalleryVerticalEnd },
  { id: 'value', label: tx('Valeur'), icon: BarChart3 },
  { id: 'scan', label: tx('Scanner'), icon: ScanLine, center: true },
  { id: 'decks', label: tx('Decks'), icon: Swords },
  { id: 'boxes', label: tx('Boîtes'), icon: Package },
  { id: 'more', label: tx('Plus'), icon: MoreHorizontal },
];

export default function BottomTabBar({ activeTab, onTabChange, scannedCount }) {
  const attention = useNeedsAttention();
  return (
    <nav
      aria-label={tx('Navigation principale')}
      className="flex-shrink-0 z-40 bg-rift-900 border-t border-gold-500/35"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-7 items-end h-[68px]">
        {TABS.map(({ id, label, icon: Icon, center }) => {
          const isActive = activeTab === id;
          if (center) {
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center gap-1 pb-2 -mt-7 min-w-0"
              >
                <span className={`hexagon w-[54px] h-[54px] flex items-center justify-center transition-colors ${isActive ? 'bg-gold-400' : 'bg-gold-500 active:bg-gold-600'}`}>
                  <Icon className="w-7 h-7 text-rift-900" strokeWidth={2.4} />
                </span>
                <span className={`text-[11px] font-bold ${isActive ? 'text-gold-400' : 'text-rift-300'}`}>{label}</span>
              </button>
            );
          }
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`h-full min-w-0 flex flex-col items-center justify-center gap-1 relative transition-colors ${
                isActive ? 'text-gold-400' : 'text-rift-400 active:text-rift-200'
              }`}
            >
              {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2px] bg-gold-400" />}
              <span className="relative">
                <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
                {id === 'more' && attention && <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rotate-45 bg-gold-400" aria-label={tx('À voir dans Réglages')} />}
                {id === 'collection' && scannedCount > 0 && (
                  <span className="absolute -top-1.5 -right-3 min-w-[18px] h-4 bg-gold-500 text-rift-900 text-[11px] font-bold flex items-center justify-center px-1">
                    {scannedCount > 999 ? '999+' : scannedCount}
                  </span>
                )}
              </span>
              <span className={`max-w-full truncate px-0.5 text-[11px] tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
