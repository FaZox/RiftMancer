import { locale, tx } from './i18n.js';
/**
 * Version of the app, from package.json only (lot 2.2: one source, injected by
 * vite.config.js), and the build date. Shown in Réglages → À propos, written
 * in the bench metadata. The APK (versionCode) and the installer read
 * package.json too.
 */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const BUILD_TIME = typeof __BUILD_TIME__ === 'number' ? __BUILD_TIME__ : null;

/** « construite le 17 novembre 2026 », or '' without a build date (tests). */
export function buildDateLabel(time = BUILD_TIME) {
  if (!Number.isFinite(time)) return '';
  return tx('construite le {date}', { date: new Date(time).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) });
}
