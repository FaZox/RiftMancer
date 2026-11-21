/**
 * Default values of new copies (scan and manual add), and what « Rétablir les
 * valeurs par défaut » goes back to — the one source for the PC and the phone.
 * French, like the rest of the app's defaults.
 */
export const DEFAULT_BATCH = Object.freeze({ condition: 'Near Mint', language: 'French', foil: false });

/** Defaults restored, keeping the scan target (box or deck) if any. */
export function resetBatchDefaults(current) {
  return current?.target ? { ...DEFAULT_BATCH, target: current.target } : { ...DEFAULT_BATCH };
}
