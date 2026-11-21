/**
 * When the « IA indisponible » banner shows (AIStatusBanner): the AI
 * recognition is chosen but could not start — model missing, or catalog
 * signatures made by another model (SHA-256 of the header). No silent fallback.
 */
export function shouldShowAIBanner(prefs, status) {
  return prefs.recognition !== 'grid16' && status.state === 'error';
}
