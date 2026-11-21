/**
 * First launch (lot 6 g): the presentation is for a NEW install only — never
 * for someone who already has cards, a « À ajouter » list or a paired device
 * (an update of the app). Then it is marked done; Réglages → Aide replays it.
 */
export function shouldWelcome({ done, copies = 0, pending = 0, paired = false }) {
  return !done && copies === 0 && pending === 0 && !paired;
}
