// Sprawdza, że każdy handler inline w index.html (onclick/oninput/...) wskazuje na
// funkcję, która naprawdę istnieje. Chroni przed literówką, która wycisza przycisk.
// Uruchom: npm test  (wymaga: npm install)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '..', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');

function ctx() {
  const c = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  c.measureText = () => ({ width: 10 });
  c.createLinearGradient = () => ({ addColorStop: () => {} });
  return c;
}

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:3000/' });
const win = dom.window;
win.HTMLCanvasElement.prototype.getContext = () => ctx();
win.fetch = () => Promise.reject(new Error('offline'));
win.requestAnimationFrame = () => 0;
win.cancelAnimationFrame = () => {};

// wbudowane globalne JS — ich nie wolno zgłaszać jako brakujące handlery
const BUILTIN = /^(if|for|while|do|switch|return|typeof|function|alert|confirm|prompt|parseInt|parseFloat|Number|String|Boolean|Object|Array|Math|JSON|Date|this|void|new|delete|in|of)$/;

const handlers = new Map();
const ATTR = /\bon(?:click|dblclick|input|change|submit|pointerdown|load|error)\s*=\s*"([^"]*)"/g;
for (const m of html.matchAll(ATTR)) {
  for (const call of m[1].matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = call[1];
    if (BUILTIN.test(name)) continue;
    handlers.set(name, (handlers.get(name) || 0) + 1);
  }
}

let failed = 0;
const ok = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
  if (!cond) failed++;
};

console.log('=== handlery inline ===');
const missing = [];
for (const [name, count] of [...handlers].sort()) {
  const known = typeof win[name] === 'function' || name in win;
  if (!known) missing.push(name + ' (' + count + ')');
}
ok('wszystkie handlery rozpoznane', missing.length === 0, missing.join(', ') || `${handlers.size} unikalnych`);

let total = 0;
for (const n of handlers.values()) total += n;
console.log('  · unikalne handlery: ' + handlers.size + ' | wywołań: ' + total);

console.log('\n=== funkcje kluczowe ===');
for (const fn of ['handleLogin', 'openPhotos', 'showRegister', 'frogEdSetTool', 'spikeInit', 'spikeRun', 'spikeStop', 'spikeExample']) {
  ok(fn + '() zdefiniowana', typeof win[fn] === 'function');
}

console.log('\n' + (failed ? '✗ BŁĘDÓW: ' + failed : '✓ HANDLERY OK'));
process.exit(failed ? 1 : 0);
