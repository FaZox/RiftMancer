/** The nine settings sections of B.4 (light: also used by the global search). */
import { RefreshCw, HardDrive, Layers, ScanLine, Euro, Eye, Swords, LifeBuoy, Info, Wrench } from 'lucide-react';
import { tx } from '../../lib/i18n.js';

export const SECTIONS = [
  { id: 'sync', label: tx('Synchronisation'), icon: RefreshCw },
  { id: 'backup', label: tx('Sauvegardes'), icon: HardDrive },
  { id: 'content', label: tx('Contenu'), icon: Layers },
  { id: 'scan', label: tx('Scanner'), icon: ScanLine },
  { id: 'price', label: tx('Prix'), icon: Euro },
  { id: 'display', label: tx('Affichage'), icon: Eye },
  { id: 'game', label: tx('Jeu'), icon: Swords },
  { id: 'help', label: tx('Aide'), icon: LifeBuoy },
  { id: 'about', label: tx('À propos'), icon: Info },
];
export const DEV_SECTION = { id: 'dev', label: tx('Développeur'), icon: Wrench };
