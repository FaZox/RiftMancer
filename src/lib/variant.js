/**
 * Test version of the apps (« RiftMancer Test » on PC, « RiftMancer
 * Test » on Android): shows a TEST badge and « (TEST) » in the title so the
 * test app is never mistaken for the one used every day.
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export async function detectTestBuild() {
  if (typeof window !== 'undefined' && window.riftboundDesktop) return window.riftboundDesktop.variant === 'test';
  if (Capacitor.isNativePlatform()) {
    try {
      const { id } = await App.getInfo();
      return /\.test$/.test(id || '');
    } catch {
      return false;
    }
  }
  return false;
}

export async function markTestBuild() {
  const test = await detectTestBuild();
  if (test) document.documentElement.dataset.variant = 'test';
  if (!test) return;
  document.title = `${document.title} (TEST)`;
  const badge = document.createElement('div');
  badge.className = 'rb-test-badge';
  badge.textContent = 'TEST';
  badge.setAttribute('aria-label', 'Version de test');
  document.body.appendChild(badge);
}
