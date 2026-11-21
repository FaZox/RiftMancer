// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from './helpers.mjs';
await loadCatalog();
const { sanitizeHtml } = await import('../src/lib/sanitizeHtml.js');
const { rulesTextHtml } = await import('../src/lib/cardLocale.js');

test('rules text: injected HTML is neutralised', () => {
  const out = rulesTextHtml({ text: '<img src=x onerror=alert(1)>Hello', isHtml: true });
  assert.ok(!/onerror/i.test(out) && !/<img/i.test(out), out);
  assert.ok(out.includes('Hello'));
});

test('sanitizeHtml keeps formatting, drops attributes and other tags', () => {
  assert.equal(sanitizeHtml('<b class="x" onclick="y">Gras</b><br/><i>it</i>'), '<b>Gras</b><br><i>it</i>');
  assert.equal(sanitizeHtml('<script>alert(1)</script>ok'), 'alert(1)ok');
  assert.equal(sanitizeHtml('<a href="javascript:x">lien</a>'), 'lien');
  assert.equal(sanitizeHtml('<span style="background:url(x)">s</span>'), '<span>s</span>');
  assert.equal(sanitizeHtml('a < b'), 'a &lt; b');
  assert.ok(!/<svg|onload/i.test(sanitizeHtml('<svg/onload=alert(1)>')));
});

test('rules text: game icons and keywords still rendered after sanitizing', () => {
  const out = rulesTextHtml({ text: '<p>[Assault 2] Pay :rb_energy_2: and :rb_rune_fury:</p>', isHtml: true });
  assert.ok(out.includes('2 énergie') && out.includes('Rune Fureur') && out.includes('Assault 2'));
});
