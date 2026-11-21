/**
 * Keeps the screen on during a game (score counter).
 * Android app: native flag (RiftboundScreen plugin, ScreenPlugin.java);
 * elsewhere: the Screen Wake Lock API when the browser has it.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export const Screen = registerPlugin('RiftboundScreen'); // also the text size (textSize.js)
let lock = null;

export async function keepAwake(on) {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('RiftboundScreen')) {
      await Screen.keepAwake({ on: !!on });
      return true;
    }
    if (on && navigator.wakeLock?.request) {
      lock = await navigator.wakeLock.request('screen');
      return true;
    }
    if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    /* not supported: the screen may turn off */
  }
  return false;
}
