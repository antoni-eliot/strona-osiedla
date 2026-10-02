// Regresja: 6 błędów naprawionych w silniku klocków Spike Prime.
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
const win = dom.window, doc = win.document;
win.HTMLCanvasElement.prototype.getContext = () => ctx();
win.fetch = () => Promise.reject(new Error('offline'));
win.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
win.cancelAnimationFrame = (id) => clearTimeout(id);

let failed = 0;
const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x !== undefined ? '  → ' + x : '')); if (!c) failed++; };
const v = (n) => (n in win) ? win[n] : win.eval(n);
const B = () => v('spikeBlocks');

(async () => {
  win.spikeInit();
  win.spikeClearScripts();

  // ── BUG 1: spikeAttachAfter gubił wypchnięty następnik ──────────────────
  console.log('=== BUG 1: wstawianie w środek łańcucha ===');
  const a = win.spikeNewBlock('hat_flag'), b = win.spikeNewBlock('wait'), c = win.spikeNewBlock('matrix');
  win.spikeAttachTop(a.id, 20, 20);
  win.spikeAttachAfter(a.id, b.id);
  win.spikeAttachAfter(b.id, c.id);
  ok('łańcuch bazowy', B()[a.id].next === b.id && B()[b.id].next === c.id);
  const w2 = win.spikeNewBlock('wait');
  win.spikeAttachAfter(a.id, w2.id);
  ok('wstawiony blok nie gubi następników', B()[w2.id].next === b.id,
     'w2.next=' + B()[w2.id].next + ' (b=' + b.id + ')');
  ok('łańcuch ma 4 klocki', win.spikeChainLen(a.id) === 4, String(win.spikeChainLen(a.id)));

  // ── BUG 2: attach gubił łańcuch doklejanego stosu ──────────────────────
  console.log('\n=== BUG 2: doklejanie gotowego stosu ===');
  const rep = win.spikeNewBlock('repeat');
  win.spikeAttachAfter(b.id, rep.id);
  const body = win.spikeChain(['drive_time', 'turn_deg', 'light_color'],
    { drive_time: { SEC: 1.2, PWR: 55 }, turn_deg: { DEG: 90 }, light_color: { COL: 'żółty', BR: 100 } });
  win.spikeAttachSub(rep.id, body);
  ok('cały stos wszedł do jamy', win.spikeChainLen(rep.id && B()[rep.id].sub) === 3,
     String(win.spikeChainLen(B()[rep.id].sub)));
  ok('kolejność w jamie zachowana',
     B()[B()[rep.id].sub].op === 'drive_time' && B()[B()[B()[rep.id].sub].next].op === 'turn_deg');

  // ── BUG 3: spikeDeleteBlock kasował następnika ─────────────────────────
  console.log('\n=== BUG 3: usuwanie klocka ===');
  const before = win.spikeChainLen(a.id);
  win.spikeDeleteBlock(w2.id);
  ok('następnik przejął miejsce usuniętego', B()[a.id].next === b.id, 'next=' + B()[a.id].next);
  ok('łańcuch skurczył się o 1', win.spikeChainLen(a.id) === before - 1,
     before + ' → ' + win.spikeChainLen(a.id));
  // zawartość jamy ginie RAZEM z klockiem C
  const rep2 = win.spikeNewBlock('repeat');
  win.spikeAttachAfter(a.id, rep2.id);
  win.spikeAttachSub(rep2.id, win.spikeChain(['wait', 'wait']));
  const inner = B()[rep2.id].sub;
  win.spikeDeleteBlock(rep2.id);
  ok('zawartość jamy usunięta z klockiem C', !B()[inner] && !B()[B()[inner] && B()[inner].next]);

  // ── BUG 4: spikeChain nie stosował wartości pól ────────────────────────
  console.log('\n=== BUG 4: wartości pól w spikeChain ===');
  win.spikeClearScripts();
  const ch = win.spikeChain(['drive_time', 'turn_deg', 'light_color'],
    { drive_time: { SEC: 1.2, PWR: 55 }, turn_deg: { DEG: 90 }, light_color: { COL: 'żółty', BR: 100 } });
  const l1 = B()[ch], l2 = B()[l1.next], l3 = B()[l2.next];
  ok('SEC zastosowane', l1.f.SEC === 1.2, String(l1.f.SEC));
  ok('PWR zastosowane', l1.f.PWR === 55, String(l1.f.PWR));
  ok('DEG zastosowane', l2.f.DEG === 90, String(l2.f.DEG));
  ok('COL/BR zastosowane', l3.f.COL === 'żółty' && l3.f.BR === 100, l3.f.COL + '/' + l3.f.BR);

  // ── BUG 5: klocki C nie wykonywały b.next ──────────────────────────────
  console.log('\n=== BUG 5: kod po klocku C był nieosiągalny ===');
  win.spikeClearScripts();
  const h = win.spikeNewBlock('hat_flag');
  win.spikeAttachTop(h.id, 10, 10);
  const r = win.spikeNewBlock('repeat');
  r.f.N = 2;
  win.spikeAttachAfter(h.id, r.id);
  const d = win.spikeNewBlock('drive_time');
  d.f.SEC = 0.1;
  win.spikeAttachSub(r.id, d.id);
  const lc = win.spikeNewBlock('light_color');
  lc.f.COL = 'pomarańczowy';
  win.spikeAttachAfter(r.id, lc.id);
  const mx = win.spikeNewBlock('matrix');
  mx.f.PAT = 'uśmiech';
  win.spikeAttachAfter(lc.id, mx.id);
  win.spikeRun();
  let waited = 0;
  while (waited < 15000 && v('spikeHub').pattern !== 'uśmiech') {
    await new Promise((res) => setTimeout(res, 200));
    waited += 200;
  }
  ok('blok po pętli wykonał się (matryca)', v('spikeHub').pattern === 'uśmiech', waited + ' ms');
  ok('blok po pętli wykonał się (kolor)', v('spikeHub').light === '#f97316', v('spikeHub').light);
  win.spikeStop();

  // ── BUG 6: spikeExample miał martwe klocki na repeat.next ──────────────
  console.log('\n=== BUG 6: przykład nie miał martwego kodu ===');
  win.spikeExample();
  const ex = B();
  const flagId = v('spikeScripts')[0];
  const setP = ex[flagId].next;                 // id set_power
  ok('set_power przed pętlą', ex[setP] && ex[setP].op === 'set_power', ex[setP] && ex[setP].op);
  const repEx = ex[setP].next;                  // id powtórz
  ok('powtórz po set_power', ex[repEx] && ex[repEx].op === 'repeat', ex[repEx] && ex[repEx].op);
  const sub1 = ex[repEx] && ex[repEx].sub;
  const sub2 = sub1 && ex[sub1].next;
  ok('pętla ma wnętrze: jedź → skręć',
     ex[sub1] && ex[sub1].op === 'drive_time' && ex[sub2] && ex[sub2].op === 'turn_deg',
     (ex[sub1] || {}).op + ' → ' + (ex[sub2] || {}).op);
  const after1 = repEx && ex[repEx].next;
  const after2 = after1 && ex[after1].next;
  ok('po pętli: światło → matryca',
     ex[after1] && ex[after1].op === 'light_color' && ex[after2] && ex[after2].op === 'matrix',
     (ex[after1] || {}).op + ' → ' + (ex[after2] || {}).op);
  ok('oba przykładowe skrypty to czapki',
     v('spikeScripts').length === 2 && v('spikeScripts').every((id) => ex[id].op.indexOf('hat_') === 0));
  win.spikeRenderWorkspace();
  ok('wszystkie klocki przykładu wyrenderowane',
     doc.querySelectorAll('#spikeWs .spike-block').length === Object.keys(ex).length,
     doc.querySelectorAll('#spikeWs .spike-block').length + ' / ' + Object.keys(ex).length);

  // ── wzmocnienia: gniazda ────────────────────────────────────────────────
  console.log('\n=== hardening: gniazda ===');
  win.spikeClearScripts();
  const ifb = win.spikeNewBlock('ifelse');
  win.spikeAttachTop(ifb.id, 10, 10);
  const wt = win.spikeNewBlock('wait');
  ok('zapis do niezadeklarowanego gniazda odrzucony',
     (win.spikeSetSlot(wt.id, 'SEC', ifb.id), JSON.stringify(B()[wt.id].s) === '{}'),
     JSON.stringify(B()[wt.id].s));
  ok('obiekt zamiast id odrzucony', (win.spikeSetSlot(ifb.id, 'COND', B()[wt.id]), B()[ifb.id].s.COND === null),
     String(B()[ifb.id].s.COND));
  const dist = win.spikeNewBlock('rep_distance');
  win.spikeSetSlot(ifb.id, 'COND', dist.id);
  ok('reporter w gnieździe COND', B()[ifb.id].s.COND === dist.id);
  const lt = win.spikeNewBlock('lt');
  win.spikeSetSlot(ifb.id, 'COND', lt.id);
  ok('wyrzucony reporter wraca na luz', v('spikeScripts').includes(dist.id));
  ok('zagnieżdżony reporter działa', typeof win.spikeEvalBlock(lt.id) === 'boolean', String(win.spikeEvalBlock(lt.id)));
  win.spikeRenderWorkspace();
  ok('zagnieżdżenie reporterów w DOM',
     !!doc.querySelector('#spikeWs .spike-slot[data-slot="COND"] .spike-block'));

  // ── koła: port z silnikiem dużym, a nie "gdziekolwiek jest silnik" ────
  console.log('\n=== koła napędowe ===');
  const setPorts = (o) => { Object.assign(v('spikeModel').ports, o); };
  setPorts({ A: 'motorL', B: null, C: null, D: null, E: null });
  ok('silnik na A → koło tylko na A', v('spikeWheelIs')('A') === true && v('spikeWheelIs')('B') === false,
     'A=' + v('spikeWheelIs')('A') + ' B=' + v('spikeWheelIs')('B'));
  setPorts({ A: null, B: 'motorL' });
  ok('silnik na B → koło tylko na B', v('spikeWheelIs')('A') === false && v('spikeWheelIs')('B') === true,
     'A=' + v('spikeWheelIs')('A') + ' B=' + v('spikeWheelIs')('B'));
  setPorts({ A: 'motorL', B: 'motorL' });
  ok('silniki na A i B → dwa koła', v('spikeWheelIs')('A') && v('spikeWheelIs')('B'));
  setPorts({ A: null, B: null, C: 'motorL' });
  ok('silnik na C → brak kół napędowych',
     !v('spikeWheelIs')('A') && !v('spikeWheelIs')('B'));
  // JEDEN silnik: napęd różnicowy daje ruch po łuku (promień = baza/2) z połową prędkości,
  // a nie ruch po wprost. Porównujemy z dwoma kołami na tym samym czasie.
  const runScenario = (pA, pB) => {
    v('spikeReset')();
    v('spikeModel').ports.A = pA; v('spikeModel').ports.B = pB;
    v('spikeMotors').A = { on: pA === 'motorL', pwr: 50, deg: 0 };
    v('spikeMotors').B = { on: pB === 'motorL', pwr: 50, deg: 0 };
    const sx = v('spikeRobot').x, sy = v('spikeRobot').y, sa = v('spikeRobot').a;
    v('spikeUpdate')(0.2);
    return { dist: Math.hypot(v('spikeRobot').x - sx, v('spikeRobot').y - sy),
             turn: Math.abs(v('spikeRobot').a - sa) };
  };
  const two = runScenario('motorL', 'motorL');
  const one = runScenario('motorL', null);
  ok('dwa koła jadą na wprost (bez skrętu)', two.turn < 0.01,
     'skręt ' + (two.turn * 180 / Math.PI).toFixed(2) + '°, dystans ' + two.dist.toFixed(1) + ' cm');
  ok('jedno koło skręca', one.turn > 0.05,
     'skręt ' + (one.turn * 180 / Math.PI).toFixed(0) + '°');
  ok('jedno koło jedzie z połową prędkości', Math.abs(one.dist - two.dist / 2) < 0.01,
     one.dist.toFixed(2) + ' cm vs ' + (two.dist / 2).toFixed(2) + ' cm');
  setPorts({ A: 'motorL', B: 'motorL' });

  // ── trwałość ────────────────────────────────────────────────────────────
  console.log('\n=== trwałość ===');
  win.spikeSave();
  const nScripts = v('spikeScripts').length, nBlocks = Object.keys(B()).length;
  win.eval('spikeScripts = []; spikeBlocks = {}; spikeSeq = 1;');
  win.spikeInit();
  ok('skrypty odtworzone', v('spikeScripts').length === nScripts, nScripts + ' → ' + v('spikeScripts').length);
  ok('klocki odtworzone', Object.keys(B()).length === nBlocks, nBlocks + ' → ' + Object.keys(B()).length);
  ok('brak wiszących odwołań', v('spikeScripts').every((id) => !!B()[id]) &&
     Object.values(B()).every((x) => (!x.next || !!B()[x.next]) && (!x.sub || !!B()[x.sub]) && (!x.elsub || !!B()[x.elsub])));

  console.log('\n' + (failed ? '✗ BŁĘDÓW: ' + failed : '✓ WSZYSTKIE TESTY REGRESJI PRZESZŁY'));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('FATAL: ' + e.stack); process.exit(1); });
