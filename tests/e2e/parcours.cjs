/**
 * Screen tests (lot 11.3): three journeys through the real app, built
 * (`dist/`), in an Electron window the size of a phone, with an empty
 * profile each time. Run by scripts/e2e.mjs (npm run test:e2e):
 *   1. scan a test photo → « Ajouter à la collection » → find the card in the collection;
 *   2. create a deck without a Legend → see the error;
 *   3. back up → change something → restore → the change is gone.
 * Env: DIST (built app), IMAGE (test photo), CARD (its French name), OUT (screenshots on failure).
 */
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIST = process.env.DIST;
const OUT = process.env.OUT;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.onnx': 'application/octet-stream',
};

/** The built app, served on 127.0.0.1 only (a random free port). */
function serve() {
  const root = path.resolve(DIST);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let win;
const js = (code) => win.webContents.executeJavaScript(code);

/** Waits until `code` (a JS expression) is truthy in the page. */
async function waitFor(code, what, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await js(code)) return; } catch { /* page loading */ }
    await sleep(150);
  }
  throw new Error(`attendu en ${timeout / 1000} s : ${what}`);
}
const textIs = (t) => `document.body && document.body.innerText.includes(${JSON.stringify(t)})`;
const waitText = (t, timeout) => waitFor(textIs(t), `le texte « ${t} »`, timeout);
const hasText = (t) => js(textIs(t));

/** Clicks the visible button (or tab, link) whose text or label contains `t`; `last` picks the last one (a dialog's). */
async function click(t, { last = false, exact = false } = {}) {
  const code = `(() => {
    const t = ${JSON.stringify(t)};
    const ok = (s) => ${exact} ? s === t : s.includes(t);
    const all = [...document.querySelectorAll('button, [role=tab], a')].filter(b => {
      const r = b.getBoundingClientRect();
      const s = (b.innerText || '').trim() || b.getAttribute('aria-label') || '';
      return r.width > 0 && r.height > 0 && !b.disabled && (ok(s) || ok(b.getAttribute('aria-label') || ''));
    });
    const b = ${last} ? all[all.length - 1] : all[0];
    if (!b) return false;
    b.click();
    return true;
  })()`;
  await waitFor(code, `un bouton « ${t} »`);
  await sleep(250);
}
/** A tab of the bottom bar (its text may carry a badge, « 1 Collection »). */
async function tab(label) {
  const code = `(() => {
    const b = [...document.querySelectorAll('nav button')].find(b => b.getBoundingClientRect().width > 0
      && (b.innerText || '').split('\\n').map(s => s.trim()).includes(${JSON.stringify(label)}));
    if (!b) return false;
    b.click();
    return true;
  })()`;
  await waitFor(code, `l’onglet « ${label} »`);
  await sleep(300);
}

/** Puts a file in a file input, like the system file picker would (DevTools protocol). */
async function setFile(selector, file) {
  const dbg = win.webContents.debugger;
  if (!dbg.isAttached()) dbg.attach('1.3');
  const { root } = await dbg.sendCommand('DOM.getDocument', { depth: 1 });
  const { nodeId } = await dbg.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error(`champ de fichier introuvable : ${selector}`);
  await dbg.sendCommand('DOM.setFileInputFiles', { nodeId, files: [path.resolve(file)] });
}

async function shot(name) {
  if (!OUT) return;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.png`), (await win.webContents.capturePage()).toPNG());
}

// ─── The journeys ────────────────────────────────────────────────────────
async function start(url) {
  await win.loadURL(url);
  await waitFor(`!!document.querySelector('nav') || ${textIs('Passer')}`, 'l’appli démarrée', 90000);
  if (await hasText('Passer')) await click('Passer', { exact: true }); // first launch
}

async function scanAndFind() {
  await tab('Scanner');
  await click('Importer une photo');
  await waitFor(`!!document.querySelector('input[type=file]:not([capture])')`, 'le choix de photo');
  await setFile('input[type=file]:not([capture])', process.env.IMAGE);
  await waitText('Résultats (1)', 120000); // detector + catalogue (first scan: models load)
  await waitText(process.env.CARD, 30000);
  await click('Ajouter à la collection'); // a photo's card goes straight to the collection
  await waitText(`+ ${process.env.CARD}`); // the confirmation message
  await tab('Collection');
  await waitText('1 carte · 1 différente', 20000);
  const found = await js(`[...document.querySelectorAll('img')].some(i => (i.alt || '').includes(${JSON.stringify(process.env.CARD)}) || (i.closest('[title]')?.title || '').includes(${JSON.stringify(process.env.CARD)}))`)
    || await hasText(process.env.CARD);
  if (!found) throw new Error(`« ${process.env.CARD} » absente de la collection`);
}

async function invalidDeck() {
  await tab('Decks');
  await click('Nouveau deck');
  await waitText('problème');
  if (!(await hasText('Choisissez une Légende.'))) await click('Détails', { exact: true });
  await waitText('Choisissez une Légende.');
  await click('Retour');
}

async function backupRestore() {
  // the decks shown on screen (the other tabs stay mounted, hidden)
  const decks = () => js(`[...document.querySelectorAll('button p')].filter(p => p.getBoundingClientRect().width > 0 && /^Deck \\d+$/.test(p.innerText.trim())).map(p => p.innerText.trim()).sort().join(',')`);
  const decksBecome = async (want, what) => {
    let got = '';
    for (let i = 0; i < 80 && (got = await decks()) !== want; i++) await sleep(250);
    if (got !== want) throw new Error(`${what} : ${got || 'aucun'} (attendu ${want})`);
  };
  await tab('Decks');
  await waitText('Deck 1');
  const before = await decks();
  await tab('Plus');
  await click('Réglages');
  await click('Sauvegardes');
  await click('Sauvegarder maintenant');
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.innerText.includes('Restaurer'))`, 'la sauvegarde dans la liste');
  // a change after the backup: a second deck
  await tab('Decks');
  await click('Nouveau deck');
  await click('Retour');
  await decksBecome(`${before},Deck 2`, 'decks avant restauration');
  await tab('Plus');
  await click('Réglages');
  await click('Sauvegardes');
  await click('Restaurer', { exact: true });
  await waitFor(`!!document.querySelector('[role=dialog], [role=alertdialog]')`, 'la demande de confirmation');
  await click('Restaurer', { exact: true, last: true });
  await sleep(1500);
  await tab('Decks');
  await decksBecome(before, 'decks après restauration');
}

const JOURNEYS = [
  ['Scanner une photo, valider, retrouver la carte', scanAndFind],
  ['Créer un deck invalide, voir l’erreur', invalidDeck],
  ['Sauvegarder, modifier, restaurer', backupRestore],
];

app.whenReady().then(async () => {
  const { server, url } = await serve();
  win = new BrowserWindow({ show: false, width: 412, height: 915, webPreferences: { partition: `e2e-${Date.now()}`, backgroundThrottling: false } });
  win.webContents.on('console-message', (e) => { if (e.level === 'error') console.error('   [page]', String(e.message).slice(0, 200)); });
  let failed = 0;
  try {
    await start(url);
    for (const [name, run] of JOURNEYS) {
      const t = Date.now();
      try {
        await run();
        console.log(`✔ ${name} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
      } catch (err) {
        failed++;
        console.log(`✖ ${name} — ${err.message}`);
        await shot(name.replace(/[^a-zA-Z]+/g, '-'));
      }
    }
  } catch (err) {
    failed = JOURNEYS.length;
    console.log(`✖ démarrage — ${err.message}`);
    await shot('demarrage');
  }
  console.log(failed ? `${failed} parcours en échec sur ${JOURNEYS.length}` : `${JOURNEYS.length} parcours réussis`);
  server.close();
  app.exit(failed ? 1 : 0);
});
