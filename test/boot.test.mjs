// Regresja: strona musi wstać nawet bez localStorage.
// Uruchom: npm test  (wymaga: npm install)
//
// BUG: bootstrap motywy ciągnął `localStorage.getItem('darkMode')` bez try/catch.
// Gdy storage jest niedostępne (tryb prywatny Safari, sandbox, iframe,
// część przeglądarek przy file://), wyjątek zabijał CAŁY skrypt - wykonanie
// zatrzymywało się w połowie, więc każde `const` zadeklarowane niżej zostawało
// w TDZ. Efekt: totalnie martwa strona, a nie tylko zepsuty motyw.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');

let failed = 0;
const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x !== undefined ? '  → ' + x : '')); if (!c) failed++; };

// about:blank to specjalny origin bez localStorage - idealne do symulacji problemu.
console.log('=== start strony bez localStorage (about:blank) ===');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const win = dom.window;

ok('localStorage faktycznie niedostępne', typeof win.localStorage === 'undefined'
   || (() => { try { win.localStorage.setItem('x', '1'); win.localStorage.removeItem('x'); return false; } catch { return true; } })());
ok('skrypt bez nieobsłużonych wyjątków', errors.length === 0, errors.slice(0, 3).join(' | ') || 'brak błędów');

// Gdyby skrypt się urwał, te consty zostałyby w TDZ i eval rzuciłby ReferenceError.
const probe = (expr) => { try { return { ok: true, val: win.eval(expr) }; } catch (e) { return { ok: false, val: e.message }; } };
for (const name of ['SPIKE_MODEL_KEY', 'SPIKE_SCRIPTS_KEY', 'SPIKE_DEFS', 'SPIKE_CAT_CLS']) {
  const r = probe(name);
  ok(name + ' zainicjalizowany', r.ok, r.ok ? String(r.val) : r.val);
}
ok('spikeInit dostępna', probe('typeof spikeInit').val === 'function');
ok('spikeBuildBlock dostępna', probe('typeof spikeBuildBlock').val === 'function');
ok('handlery starej gry nietknięte', probe('typeof handleLogin').val === 'function'
   && probe('typeof frogEdSetTool').val === 'function'
   && probe('typeof openPhotos').val === 'function');

// Motyw ma działać mimo braku storage (domyślny = jasny).
ok('motyw domyślny bez storage', !win.document.body.classList.contains('dark-mode'));

// Przełącznik motywu nie może rzucić, gdy storage jest niedostępne.
try {
  const r = probe('typeof toggleDarkMode === "function" ? toggleDarkMode() : "brak"');
  ok('toggleDarkMode() nie rzuca', r.ok, r.ok ? String(r.val) : r.val);
} catch (e) {
  ok('toggleDarkMode() nie rzuca', false, e.message);
}

// Ten sam skrypt z działającym storage nadal musi wstać (brak regresji).
console.log('\n=== start strony z localStorage (normalne środowisko) ===');
const err2 = [];
const vc2 = new VirtualConsole();
vc2.on('jsdomError', (e) => err2.push(e.message));
const dom2 = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:3000/', virtualConsole: vc2 });
ok('bez błędów z storage', err2.length === 0, err2.slice(0, 2).join(' | ') || 'brak');
ok('SPIKE_MODEL_KEY nadal zainicjalizowany', dom2.window.eval('typeof SPIKE_MODEL_KEY') === 'string');

console.log(failed ? `\n✗ BŁĘDÓW: ${failed}` : '\n✓ STRONA WSTAJE W OBA ŚRODOWISKACH');
process.exit(failed ? 1 : 0);
