/**
 * « Taille du texte » Normal / Grand (B.4, Affichage). The platform's own
 * zoom, so every text grows without breaking the layout:
 *   phone: the WebView's text zoom (RiftboundScreen.setTextZoom, 118 %);
 *   PC: the window's zoom factor (× 1.12, on top of the screen-size zoom);
 *   browser: the page zoom.
 */
import { Capacitor } from '@capacitor/core';

export const TEXT_ZOOM = { normal: 1, large: 1.15 };

let last = null;
export async function applyTextSize(size = 'normal') {
  const z = TEXT_ZOOM[size] || 1;
  if (z === last) return;
  last = z;
  try {
    if (typeof window !== 'undefined' && window.riftboundDesktop?.display) {
      await window.riftboundDesktop.display.setTextScale(z);
    } else if (Capacitor.isNativePlatform()) {
      const { Screen } = await import('./keepAwake.js');
      await Screen.setTextZoom({ percent: Math.round(z * 100) });
    } else if (typeof document !== 'undefined') {
      document.documentElement.style.zoom = z === 1 ? '' : String(z);
    }
  } catch (err) {
    console.warn('[display] text size not applied:', err);
  }
}
