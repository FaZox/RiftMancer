import { tx } from './i18n.js';
import { sameDetector } from './scanRules.js';
/**
 * Which card catalog the phone uses: the one bundled with the app, or the one
 * received from the PC at the last sync (new sets).
 *
 * The PC's catalog is used only when it is at least as recent as the bundled
 * one (`generatedAt`, else its number of cards) AND made for the same AI model
 * and the same detector (SHA-256 of the signatures' header: the recognition
 * thresholds hold for one detector, scanRules.js). An older PC app sends an older catalog:
 * using it would switch the AI off (signatures of another model, or none) and
 * remove recent cards — the bundled catalog is used instead, and said so.
 *
 * @returns {{ use: 'bundled' | 'downloaded', reason: string | null }}
 */
export function chooseCatalog(bundled, downloaded) {
  if (!downloaded?.cards?.length) return { use: 'bundled', reason: null };
  const sha = (c) => c?.embeddings?.modelSha256 || null;
  if (sha(bundled) && sha(downloaded) !== sha(bundled)) {
    return { use: 'bundled', reason: sha(downloaded) ? tx('signatures IA d’un autre modèle') : 'pas de signatures IA' };
  }
  const det = (c) => c?.embeddings?.detectorSha256 || null;
  if (det(bundled) && !sameDetector(det(downloaded), det(bundled))) {
    return { use: 'bundled', reason: tx('seuils faits pour un autre détecteur') };
  }
  const a = downloaded.generatedAt || '';
  const b = bundled?.generatedAt || '';
  if (a && b) return a >= b ? { use: 'downloaded', reason: null } : { use: 'bundled', reason: tx('plus ancien que celui de l’appli') };
  if (b && !a) return { use: 'bundled', reason: tx('plus ancien que celui de l’appli') };
  if (downloaded.cards.length < (bundled?.cards?.length || 0)) return { use: 'bundled', reason: tx('moins de cartes que celui de l’appli') };
  return { use: 'downloaded', reason: null };
}
