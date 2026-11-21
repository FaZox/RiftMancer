/**
 * App icons from public/icon.svg (temporary neutral icon, replace the SVG
 * with the final design and run this again):
 *   - public/icon-192.png, public/icon-512.png (web app / PC window)
 *   - Android launcher icons (square, round, adaptive foreground)
 *   - build/icon.png (Windows .exe installer)
 *
 *   npm run icons
 */
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const svg = await readFile('public/icon.svg');
const BG = '#0a0e17';
const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

async function round(size) {
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
  return sharp(await png(size)).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

/** Adaptive foreground: the icon drawn in the 72 dp safe zone of a 108 dp transparent layer. */
async function foreground(size) {
  const inner = Math.round(size * 0.66);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await png(inner), gravity: 'center' }]).png().toBuffer();
}

await writeFile('public/icon-192.png', await png(192));
await writeFile('public/icon-512.png', await png(512));

if (existsSync(RES)) {
  for (const [d, k] of Object.entries(DENSITIES)) {
    const dir = `${RES}/mipmap-${d}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/ic_launcher.png`, await png(Math.round(48 * k)));
    await writeFile(`${dir}/ic_launcher_round.png`, await round(Math.round(48 * k)));
    await writeFile(`${dir}/ic_launcher_foreground.png`, await foreground(Math.round(108 * k)));
  }
  await writeFile(`${RES}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
}

await mkdir('build', { recursive: true });
await writeFile('build/icon.png', await png(512));
console.log('[icons] icons written');
