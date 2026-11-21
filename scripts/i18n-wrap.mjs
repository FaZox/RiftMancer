/**
 * Translation helper (dev tool): wraps the French texts of the interface with
 * tx() (src/lib/i18n.js), keeping the French text as the key.
 *   node scripts/i18n-wrap.mjs [--write] <files or folders…>
 * Without --write: says what it would change. Wraps:
 *   - JSX text:                        <p>Bonjour</p>           → <p>{tx('Bonjour')}</p>
 *   - text attributes (title, aria-label, placeholder, label…)  → title={tx('…')}
 *   - JS strings that read like a sentence (accent, « », ’, or several words starting with a capital)
 * Never: object keys, comparisons, imports, console / storage / fetch arguments,
 * strings already in tx() / tp(). Template strings with ${…} are listed for a
 * manual pass (word order and plurals need tp()).
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative, dirname, extname, sep } from 'node:path';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';

const traverse = traverseMod.default || traverseMod;
const write = process.argv.includes('--write');
const TEMPLATES = process.argv.includes('--templates');
const targets = process.argv.slice(2).filter(a => !a.startsWith('--'));
const ROOT = process.cwd();
const I18N = join(ROOT, 'src', 'lib', 'i18n.js');
const NEVER = new Set(['src/lib/i18n.js', 'src/lib/uiLang.js', 'src/i18n/en.js'].map(p => join(ROOT, p)));

const SKIP_ATTR = new Set(['className', 'class', 'href', 'src', 'type', 'id', 'key', 'role', 'name', 'value', 'defaultValue', 'lang', 'rel', 'target',
  'inputMode', 'autoComplete', 'accept', 'capture', 'viewBox', 'd', 'fill', 'stroke', 'strokeLinecap', 'strokeLinejoin', 'points', 'xmlns', 'method',
  'action', 'htmlFor', 'kind', 'tone', 'variant', 'icon', 'size', 'mode', 'align', 'side', 'poster', 'preserveAspectRatio', 'transform', 'pattern',
  'min', 'max', 'step', 'dir', 'form', 'enterKeyHint', 'autoCapitalize', 'spellCheck', 'loading', 'decoding', 'draggable', 'tabIndex', 'gradientUnits',
  'offset', 'stopColor', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'color', 'clipPath', 'mask', 'filter', 'fontFamily', 'textAnchor',
  'dominantBaseline', 'style', 'format', 'zone', 'tab', 'section', 'to', 'path', 'as', 'download', 'cardId', 'language', 'state', 'phase', 'sizes',
  'media', 'crossOrigin', 'referrerPolicy', 'sandbox', 'allow', 'frameBorder', 'scope', 'headers', 'wrap', 'cols', 'rows', 'colSpan', 'rowSpan',
  'gridArea', 'stroke-width', 'aria-hidden', 'aria-live', 'aria-expanded', 'aria-pressed', 'aria-selected', 'aria-current', 'aria-haspopup',
  'aria-controls', 'aria-describedby', 'aria-labelledby', 'aria-modal', 'aria-orientation', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow']);
const NO_CALL = /^(console\.|localStorage\.|sessionStorage\.|require$|fetch$|import$|JSON\.|document\.|window\.addEventListener|addEventListener|removeEventListener|querySelector|querySelectorAll|getElementById|setItem|getItem|removeItem|postMessage|tx$|tp$|RegExp$|matchMedia|Symbol|invoke|send$|on$|emit$|dispatchEvent|CustomEvent|createElement|setAttribute|getAttribute|hasOwnProperty|startsWith|endsWith|includes|split|replace|replaceAll|indexOf|match$|test$|join$|padStart|padEnd|toLocale|Intl\.)/;

const LETTERS = /[A-Za-zÀ-ÿ]{2}/;
const FRENCH = /[À-ÿœŒ’«»]/;
const looksText = (s) => LETTERS.test(s) && (FRENCH.test(s) || /\s/.test(s.trim()) || /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s));
const looksSentence = (s) => LETTERS.test(s) && (FRENCH.test(s) || (/^[A-ZÀ-Ý]/.test(s) && /\S\s+\S/.test(s)));
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

// Where a single capitalised word is a label shown on screen: { label: 'Normal' }, option tuples
// [['normal', 'Normal'], …] (not the first element: the value), `{x ? 'Oui' : 'Non'}` in JSX, default texts.
const LABEL_KEYS = new Set(['label', 'title', 'text', 'message', 'help', 'sub', 'description', 'hint', 'placeholder', 'confirmLabel',
  'cancelLabel', 'short', 'empty', 'emptyText', 'action', 'detail', 'why', 'tip', 'caption', 'heading', 'body', 'aria']);
/** A value of a table of labels shown on screen: const RESULT_LABEL = { win: 'Victoire', … } (any case). */
function inLabelTable(path) {
  const p = path.parent;
  if (p.type !== 'ObjectProperty' || p.value !== path.node || p.computed) return false;
  const decl = path.parentPath.parentPath.parent;
  return decl?.type === 'VariableDeclarator' && /(LABELS?|TEXTS?|TITLES?)$/.test(decl.id?.name || '');
}

function isLabelSpot(path) {
  const p = path.parent;
  if (p.type === 'ObjectProperty' && p.value === path.node && !p.computed) {
    const k = p.key.name || p.key.value;
    return LABEL_KEYS.has(k);
  }
  if (p.type === 'ArrayExpression' && p.elements.length >= 2 && p.elements.indexOf(path.node) >= 1 && path.parentPath.parent.type === 'ArrayExpression') return true;
  if (p.type === 'ConditionalExpression' && p.test !== path.node) {
    let a = path.parentPath;
    while (a && a.node.type === 'ConditionalExpression') a = a.parentPath;
    return !!a && (a.node.type === 'JSXExpressionContainer' || a.node.type === 'ReturnStatement' || a.node.type === 'ArrowFunctionExpression'
      || (a.node.type === 'CallExpression' && /notif|Notification|toast|ask|offerUndo|setMsg|setError|setStatus/.test(calleeName(a.node.callee))));
  }
  if (p.type === 'LogicalExpression' && p.right === path.node) return path.parentPath.parent.type === 'JSXExpressionContainer';
  if (p.type === 'AssignmentPattern' && p.right === path.node) return /label|title|text|placeholder|message|heading|caption/i.test(p.left.name || '');
  if (p.type === 'CallExpression' && p.arguments[0] === path.node) return /^(showNotification|notify|setMsg|setError|setStatus|alert)$/.test(lastPart(calleeName(p.callee)));
  return false;
}

// A binding named tx / tp that is not the import from i18n.js (it would hide it)
function foreign(scope, name) {
  const b = scope.getOwnBinding(name);
  if (!b) return false;
  return !(b.kind === 'module' && /i18n.js$/.test(b.path.parent?.source?.value || ''));
}

function calleeName(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') return `${calleeName(node.object)}.${node.property.name || ''}`.replace(/^\./, '');
  return '';
}
const lastPart = (name) => name.split('.').pop();

function wrapFile(file) {
  const src = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    return { file, error: `analyse impossible : ${e.message}` };
  }
  const edits = [];
  const templates = [];
  let clash = false;
  traverse(ast, {
    Scope(path) { if (foreign(path.scope, 'tx') || foreign(path.scope, 'tp')) clash = true; },
    Program(path) { if (foreign(path.scope, 'tx') || foreign(path.scope, 'tp')) clash = true; },
    JSXText(path) {
      const v = path.node.value;
      if (!/[A-Za-zÀ-ÿ]/.test(v) || !LETTERS.test(v)) return;
      const parentName = path.parent.openingElement?.name?.name;
      if (['pre', 'code', 'style', 'script'].includes(parentName)) return;
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v);
      const inner = m[2].replace(/\s+/g, ' ');
      const lead = m[1], trail = m[3];
      edits.push([path.node.start, path.node.end, `${lead}{tx(${q(inner)})}${trail}`]);
    },
    JSXAttribute(path) {
      const name = path.node.name.name;
      const val = path.node.value;
      if (!val || val.type !== 'StringLiteral' || typeof name !== 'string') return;
      if (SKIP_ATTR.has(name) || name.startsWith('data-') || /^on[A-Z]/.test(name) || /Class(Name)?$/.test(name)) return;
      if (!looksText(val.value) || val.value === 'Language · Langue') return; // the language choice: both names, never translated
      edits.push([val.start, val.end, `{tx(${q(val.value)})}`]);
    },
    StringLiteral(path) {
      const p = path.parent;
      if (path.parentPath.isJSXAttribute()) return;
      if (path.parentPath.isImportDeclaration() || path.parentPath.isExportAllDeclaration() || path.parentPath.isExportNamedDeclaration()) return;
      if (p.type === 'ObjectProperty' && p.key === path.node && !p.computed) return;
      if (p.type === 'ClassProperty' && p.key === path.node) return;
      if (p.type === 'MemberExpression' && p.property === path.node) return;
      if (p.type === 'BinaryExpression' && ['==', '!=', '===', '!=='].includes(p.operator)) return;
      if (p.type === 'SwitchCase') return;
      if (p.type === 'ImportExpression' || p.type === 'TSLiteralType') return;
      if (p.type === 'CallExpression' || p.type === 'NewExpression') {
        const name = calleeName(p.callee);
        if (NO_CALL.test(name) || NO_CALL.test(lastPart(name))) return;
      }
      if (p.type === 'Directive' || p.type === 'DirectiveLiteral') return;
      if (['French', 'English', 'Near Mint'].includes(path.node.value)) return; // card language / condition values, not texts
      if (inLabelTable(path) && LETTERS.test(path.node.value)) { edits.push([path.node.start, path.node.end, `tx(${q(path.node.value)})`]); return; }
      if (!looksSentence(path.node.value) && !(isLabelSpot(path) && /^[A-ZÀ-Ý?—–]/.test(path.node.value) && LETTERS.test(path.node.value))) return;
      edits.push([path.node.start, path.node.end, `tx(${q(path.node.value)})`]);
    },
    TemplateLiteral(path) {
      if (!path.node.expressions.length) return;
      const raw = path.node.quasis.map(x => x.value.cooked).join('${…}');
      const text = raw.replace(/\$\{…\}/g, ' ');
      if (!looksSentence(text) || /:\/\/|^\//.test(raw)) return;
      if (!TEMPLATES) { templates.push([path.node.loc.start.line, raw.slice(0, 90)]); return; }
      // `… ${a} …` → tx('… {a} …', { a }) — only the outermost sentence, never a class name, a key or a log
      const p = path.parent;
      if (p.type === 'TaggedTemplateExpression') return;
      if (path.findParent(x => x.isTemplateLiteral() && x.node.expressions.length && x !== path)) return;
      const attr = path.findParent(x => x.isJSXAttribute());
      if (attr && (SKIP_ATTR.has(attr.node.name.name) || /Class(Name)?$/.test(attr.node.name.name))) return;
      if (p.type === 'ObjectProperty' && p.key === path.node) return;
      if (p.type === 'BinaryExpression' && ['==', '!=', '===', '!=='].includes(p.operator)) return;
      if (p.type === 'CallExpression' || p.type === 'NewExpression') {
        const name = calleeName(p.callee);
        if (NO_CALL.test(name) || NO_CALL.test(lastPart(name))) return;
      }
      const used = new Set();
      const names = path.node.expressions.map((e, i) => {
        let n = e.type === 'Identifier' ? e.name
          : e.type === 'MemberExpression' && !e.computed ? e.property.name
            : e.type === 'CallExpression' ? lastPart(calleeName(e.callee)) : '';
        if (!/^[A-Za-z_]\w*$/.test(n || '')) n = `v${i}`;
        let u = n, k = 2;
        while (used.has(u)) u = `${n}${k++}`;
        used.add(u);
        return u;
      });
      const key = path.node.quasis.map((x, i) => x.value.cooked + (i < names.length ? `{${names[i]}}` : '')).join('');
      const vars = path.node.expressions.map((e, i) => {
        const code = src.slice(e.start, e.end);
        return code === names[i] ? names[i] : `${names[i]}: ${code}`;
      }).join(', ');
      edits.push([path.node.start, path.node.end, `tx(${q(key)}, { ${vars} })`]);
    },
  });
  if (clash) return { file, error: 'tx ou tp déjà utilisé comme nom : fichier laissé tel quel' };
  if (!edits.length) return { file, edits: 0, templates };
  // a change nested inside another change (a word inside a sentence being converted): the outer one wins
  edits.splice(0, edits.length, ...edits.filter(x => !edits.some(y => y !== x && y[0] <= x[0] && y[1] >= x[1] && (y[0] < x[0] || y[1] > x[1]))));
  edits.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [s, e, r] of edits) out = out.slice(0, s) + r + out.slice(e);
  if (!/import \{[^}]*\btx\b[^}]*\} from '[^']*i18n\.js'/.test(out)) {
    let rel = relative(dirname(file), I18N).split(sep).join('/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    const imports = [...out.matchAll(/^import[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm)];
    const line = `import { tx } from '${rel}';\n`;
    if (imports.length) {
      const last = imports[imports.length - 1];
      const at = last.index + last[0].length + 1;
      out = out.slice(0, at) + line + out.slice(at);
    } else out = line + out;
  }
  if (process.argv.includes('--list')) {
    const rel = relative(ROOT, file).split(sep).join('/');
    for (const [st, en, r] of edits) console.log(`    ${rel}:${src.slice(0, st).split('\n').length}  ${src.slice(st, en).slice(0, 70)}  →  ${r.slice(0, 90)}`);
  }
  if (write) writeFileSync(file, out);
  return { file, edits: edits.length, templates };
}

function files(p) {
  const st = statSync(p);
  if (st.isDirectory()) return readdirSync(p).flatMap(n => files(join(p, n)));
  return ['.js', '.jsx'].includes(extname(p)) ? [p] : [];
}

let total = 0;
const manual = [];
for (const f of targets.flatMap(t => files(join(ROOT, t)))) {
  if (NEVER.has(f)) continue;
  const r = wrapFile(f);
  const rel = relative(ROOT, f).split(sep).join('/');
  if (r.error) { console.log(`! ${rel} : ${r.error}`); continue; }
  if (r.edits) console.log(`${String(r.edits).padStart(4)}  ${rel}`);
  total += r.edits;
  for (const [line, text] of r.templates) manual.push(`${rel}:${line}  ${text}`);
}
console.log(`\n${total} textes ${write ? 'entourés de tx()' : 'à entourer (relancer avec --write)'}`);
if (manual.length) console.log(`\n${manual.length} textes avec \${…} à reprendre à la main :\n${manual.join('\n')}`);
