/**
 * Translation check (dev tool and tests/i18n.test.mjs): every text of the
 * interface in tx('…') / tp(n, '…', '…') and whether src/i18n/en.js has it.
 *   node scripts/i18n-extract.mjs            → counts, and the missing texts
 *   node scripts/i18n-extract.mjs --json F   → writes the missing texts to F (to translate)
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';

const traverse = traverseMod.default || traverseMod;

function files(p) {
  const st = statSync(p);
  if (st.isDirectory()) return readdirSync(p).flatMap(n => files(join(p, n)));
  return ['.js', '.jsx'].includes(extname(p)) ? [p] : [];
}

/** { key → [file:line, …] } of every tx / tp text under `dirs`, and the calls that are not plain texts. */
export function collectTexts(root, dirs = ['src']) {
  const keys = new Map();
  const dynamic = [];
  for (const f of dirs.flatMap(d => files(join(root, d)))) {
    const rel = relative(root, f).split(sep).join('/');
    if (rel === 'src/i18n/en.js' || rel === 'src/lib/i18n.js') continue;
    const src = readFileSync(f, 'utf8');
    if (!/\bt[xp]\(/.test(src)) continue;
    const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
    traverse(ast, {
      CallExpression(path) {
        const c = path.node.callee;
        if (c.type !== 'Identifier' || (c.name !== 'tx' && c.name !== 'tp')) return;
        const args = c.name === 'tx' ? [path.node.arguments[0]] : path.node.arguments.slice(1, 3);
        for (const a of args) {
          const where = `${rel}:${path.node.loc.start.line}`;
          if (a?.type === 'StringLiteral') {
            if (!keys.has(a.value)) keys.set(a.value, []);
            keys.get(a.value).push(where);
          } else dynamic.push(where);
        }
      },
    });
  }
  return { keys, dynamic };
}

if (process.argv[1] && process.argv[1].endsWith('i18n-extract.mjs')) {
  const root = process.cwd();
  const EN = (await import(`file:///${join(root, 'src/i18n/en.js').split(sep).join('/')}?t=${Date.now()}`)).default;
  const { keys, dynamic } = collectTexts(root);
  const missing = [...keys.keys()].filter(k => !(k in EN));
  const unused = Object.keys(EN).filter(k => !keys.has(k));
  console.log(`${keys.size} textes, ${keys.size - missing.length} traduits, ${missing.length} à traduire, ${unused.length} traductions inutilisées`);
  if (dynamic.length) console.log(`${dynamic.length} appels tx / tp sans texte écrit en dur : ${dynamic.slice(0, 10).join(', ')}`);
  const out = process.argv.indexOf('--json');
  if (out > 0) {
    const byFile = {};
    for (const k of missing) { const f = keys.get(k)[0].split(':')[0]; (byFile[f] ||= []).push(k); }
    writeFileSync(process.argv[out + 1], JSON.stringify(byFile, null, 1));
    console.log(`→ ${process.argv[out + 1]}`);
  }
}
