/**
 * Finds the paired PC on the local network with mDNS (_riftbound._tcp), through
 * the app's own Android plugin (android/…/DiscoveryPlugin.java). Only PCs
 * announcing our fingerprint are returned. Elsewhere (web, PC) → [].
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

const Discovery = registerPlugin('RiftboundDiscovery');

/** @returns {Promise<{ host: string, port: number }[]>} */
/** `hashes`: Set of the PC fingerprints accepted (or a single one). */
export async function discoverPcs(hashes, timeout = 3000) {
  const ok = (h) => !hashes || (hashes instanceof Set ? hashes.has(h) : h === hashes);
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('RiftboundDiscovery')) return [];
  try {
    const { services = [] } = await Discovery.discover({ type: '_riftbound._tcp.', timeout });
    return services
      .filter(s => s.host && /^\d+\.\d+\.\d+\.\d+$/.test(s.host) && ok(s.txt?.h))
      .map(s => ({ host: s.host, port: Number(s.port) || 47321 }));
  } catch (err) {
    console.warn('[sync] mDNS discovery failed:', err);
    return [];
  }
}
