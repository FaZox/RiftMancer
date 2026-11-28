import React from 'react';

import { LayoutGrid, Swords, ScanLine, GalleryVerticalEnd, MoreHorizontal, BarChart3, Package } from 'lucide-react';

import { useNeedsAttention } from '../lib/attention.js';

import { tx } from '../lib/i18n.js';

// Design Hextech mobile (maquette mobile-reference.html .tabbar) : 7 onglets,
// chacun dans un hexagone ; l'actif est doré avec un trait lumineux au-dessus ;
// le Scanner est un gros hexagone doré qui pulse et dépasse de la barre.

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
    <nav aria-label={tx('Navigation principale')} className="tabbar">
      {TABS.map(({ id, label, icon: Icon, center }) => {
        const isActive = activeTab === id;
        if (center) {
          return (
            <button key={id} type="button" onClick={() => onTabChange(id)} aria-current={isActive ? 'page' : undefined} aria-label={label}>
              <span className="scanb"><Icon /></span>
            </button>
          );
        }
        return (
          <button key={id} type="button" onClick={() => onTabChange(id)} aria-current={isActive ? 'page' : undefined} className={isActive ? 'on' : undefined}>
            <span className="hx"><Icon /></span>
            <span className="truncate max-w-full">{label}</span>
            {id === 'more' && attention && <i className="dot" aria-label={tx('À voir dans Réglages')} />}
            {id === 'collection' && scannedCount > 0 && (
              <i className="cnt">{scannedCount > 999 ? '999+' : scannedCount}</i>
            )}
          </button>
        );
      })}
    </nav>
  );
}
