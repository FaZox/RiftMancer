/**
 * Deck registration sheet for tournaments (print / PDF): player, Legend,
 * champion, main deck, runes, battlefields, sideboard, totals.
 * Plain HTML printed by the browser / the PC app (no PDF library);
 * on Android the sheet is saved as an .html file to open and print.
 */
import { getMatcher } from './cardMatcher.js';
import { getLocalizedName } from './cardLocale.js';
import { formatDeckList } from './deckList.js';
import { locale, tx, tp, getLang } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function buildDeckSheetHtml(deck, { playerName = '', language = 'English' } = {}) {
  const m = getMatcher();
  const name = (id) => {
    const c = m.getCardData(id);
    return c ? getLocalizedName(c, language) : id;
  };
  const code = (id) => m.getCardData(id)?.code || '';
  const zone = (z) => (deck.cards || []).filter(s => s.zone === z && s.quantity > 0)
    .map(s => ({ q: s.quantity, n: name(s.cardId), c: code(s.cardId) }))
    .sort((a, b) => a.n.localeCompare(b.n));
  const section = (title, rows) => {
    const total = rows.reduce((n, r) => n + r.q, 0);
    return `<section><h2>${esc(title)} <span>(${total})</span></h2><table>${rows.map(r => `<tr><td class="q">${r.q}</td><td>${esc(r.n)}</td><td class="c">${esc(r.c)}</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>'}</table></section>`;
  };
  const main = zone('main');
  return `<!doctype html><html lang="${getLang()}"><head><meta charset="utf-8"><title>${esc(deck.name || 'Deck')}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font: 11pt/1.35 Arial, sans-serif; color: #111; }
  h1 { font-size: 18pt; margin: 0 0 4mm; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 8mm; margin-bottom: 5mm; }
  .meta div { border-bottom: 1px solid #999; padding: 1mm 0; }
  .meta b { display: inline-block; width: 28mm; color: #555; font-weight: normal; }
  .cols { columns: 2; column-gap: 10mm; }
  section { break-inside: avoid; margin-bottom: 5mm; }
  h2 { font-size: 12pt; margin: 0 0 1.5mm; border-bottom: 2px solid #111; }
  h2 span { font-weight: normal; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: .6mm 1mm; border-bottom: 1px solid #ddd; }
  td.q { width: 8mm; text-align: right; font-weight: bold; }
  td.c { width: 26mm; color: #666; font-size: 9pt; }
  footer { margin-top: 6mm; font-size: 9pt; color: #666; }
</style></head><body>
<h1>${esc(deck.name || 'Deck')}</h1>
<div class="meta">
  <div><b>${tx('Joueur')}</b> ${esc(playerName)}</div>
  <div><b>${tx('Date')}</b> ${esc(new Date().toLocaleDateString(locale()))}</div>
  <div><b>${tx('Légende')}</b> ${esc(deck.legendId ? name(deck.legendId) : '')}</div>
  <div><b>${tx('Champion')}</b> ${esc(deck.championId ? name(deck.championId) : '')}</div>
  <div><b>${tx('Deck principal')}</b> ${tp(main.reduce((n, r) => n + r.q, 0), '{n} carte', '{n} cartes')}</div>
  <div><b>${tx('Événement')}</b> </div>
</div>
<div class="cols">
${section(tx('Deck principal'), main)}
${section(tx('Runes'), zone('rune'))}
${section(tx('Champs de bataille'), zone('battlefield'))}
${section(tx('Réserve (sideboard)'), zone('side'))}
</div>
<footer>${tx('RiftMancer — liste texte :')}<pre>${esc(formatDeckList(deck, 'English'))}</pre></footer>
</body></html>`;
}

/** Prints the sheet (PC app / browser): the system dialog offers « PDF ». */
export function printHtml(html) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try { frame.contentWindow.focus(); frame.contentWindow.print(); } finally {
      setTimeout(() => frame.remove(), 2000);
    }
  }, 250);
}
