/**
 * Scan sounds (lot 8.2, B.6.8): three short, discreet sounds — recognised,
 * to confirm, already scanned — off by default, on top of the vibrations.
 * Made with Web Audio (no sound file). Réglages → Scanner turns them on and
 * sets the volume; the speaker of the scanner's options band mutes them.
 * The notes are pure data: tests/scanSounds.test.mjs.
 */
import { getPrefs } from './uiPrefs.js';import { tx } from './i18n.js';


/** [frequency Hz, start s, length s] per note. */
export const SOUNDS = {
  success: { wave: 'sine', notes: [[880, 0, 0.07], [1318.5, 0.075, 0.11]] },     // two rising notes
  uncertain: { wave: 'triangle', notes: [[659.3, 0, 0.16]] },                    // one held note
  duplicate: { wave: 'sine', notes: [[523.3, 0, 0.06], [523.3, 0.1, 0.06]] },    // the same low note twice
};
export const SOUND_LABELS = { success: tx('Reconnue'), uncertain: tx('À confirmer'), duplicate: tx('Déjà scannée') };
export const VOLUMES = [[0.25, tx('Faible')], [0.5, tx('Moyen')], [0.9, tx('Fort')]];

/** The sound of a scan result, or null (« non reconnue » and an empty table stay silent). */
export function soundFor(phase, prefs) {
  if (!prefs?.scanSounds) return null;
  return SOUNDS[phase] ? phase : null;
}

let ctx = null;
/** Plays a sound now (`force`: the « Écouter » buttons, even when sounds are off). */
export function playScanSound(phase, { force = false } = {}) {
  const prefs = getPrefs();
  const name = force ? (SOUNDS[phase] ? phase : null) : soundFor(phase, prefs);
  if (!name) return false;
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ctx ||= new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const vol = Math.max(0, Math.min(1, prefs.scanVolume ?? 0.5)) * 0.35; // discreet
    const t0 = ctx.currentTime + 0.01;
    for (const [freq, start, len] of SOUNDS[name].notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = SOUNDS[name].wave;
      osc.frequency.value = freq;
      // short attack and decay: no click
      gain.gain.setValueAtTime(0, t0 + start);
      gain.gain.linearRampToValueAtTime(vol, t0 + start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + len + 0.02);
    }
    return true;
  } catch {
    return false; // no audio here: the vibration remains
  }
}
