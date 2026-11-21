import { Capacitor } from '@capacitor/core';

/**
 * Which interface is in use (decided once, at start): the PC one (PC app, or a
 * browser on a computer screen) or the Android one (phone, or a narrow browser
 * window). Common components (Sheet, Field…) follow it.
 */
export const usePcInterface = typeof window !== 'undefined' && (!!window.riftboundDesktop
  || (!Capacitor.isNativePlatform() && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches));
