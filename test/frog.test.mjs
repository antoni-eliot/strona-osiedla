// Regresja: edytor stawu (kod stawu) i przełączanie stawów w grze ŻABKA.
// Uruchom: npm test  (wymaga: npm install)
import fs from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const errs=[]; const vc=new VirtualConsole();
vc.on('jsdomError', e=>errs.push(e.message));
const c = new Proxy({}, { get:(t,k)=> k in t ? t[k] : ()=>{}, set:(t,k,v)=>{t[k]=v;return true;} });
c.measureText=()=>({width:10});
c.createLinearGradient=()=>({addColorStop:()=>{}});
c.createRadialGradient=()=>({addColorStop:()=>{}});
const dom = new JSDOM(fs.readFileSync('index.html','utf8'), { runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost:3000/', virtualConsole: vc });
const w = dom.window, d = w.document;
w.HTMLCanvasElement.prototype.getContext = () => c;
w.fetch = () => Promise.reject(new Error('offline'));
w.requestAnimationFrame = cb => setTimeout(()=>cb(Date.now()),16);
w.cancelAnimationFrame = id => clearTimeout(id);
w.prompt = () => null;
let F=0; const ok=(l,cc,x)=>{console.log((cc?'  PASS  ':'  FAIL  ')+l+(x!==undefined?'  → '+x:'')); if(!cc)F++;};
ok('brak błędów przy starcie', errs.length===0, errs.slice(0,2).join('|')||'brak');

console.log('=== kod stawu ===');
w.frogMapEditorOpen(null);
ok('edytor otwarty', !d.getElementById('frogMapEditor').classList.contains('hidden'));
w.frogEdMakeCode();
const code = d.getElementById('frogEdCode').value;
ok('kod wygenerowany', /^STAW1-/.test(code), code.slice(0,24)+'… len='+code.length);
ok('jest pole na kod', !!d.getElementById('frogEdCode'));
ok('jest pole wklejania', !!d.getElementById('frogEdCodeIn'));

// zapisz staw, zmień, wczytaj z kodu -> powinien wrócić do oryginału
const before = w.eval('frogEd').cells;
const beforeCols = w.eval('frogEd').cols;
w.frogEdFill(0); // cała woda
ok('staw zmieniony na wodę', w.eval('frogEd').cells.includes('w'));
d.getElementById('frogEdCodeIn').value = code;
w.frogEdLoadCode();
ok('wczytany z kodu = oryginał', w.eval('frogEd').cells === before, 'len '+w.eval('frogEd').cells.length);
ok('rozmiar siatki zachowany', w.eval('frogEd').cols === beforeCols);
ok('starty odtworzone', Array.isArray(w.eval('frogEd').spawns) && w.eval('frogEd').spawns.length>0, JSON.stringify(w.eval('frogEd').spawns));
ok('pole wklejania wyczyszczone', d.getElementById('frogEdCodeIn').value === '');
d.getElementById('frogEdCodeIn').value = 'SMIE-CZE-KOD';
w.frogEdLoadCode();
ok('zły kod nie wywraca gry', w.eval('frogEd').cells === before);

console.log('=== przełączanie stawów ===');
w.frogCloseEditor();
const all = w.eval('frogAllMaps')().length;
ok('liczba stawów > 1', all > 1, all+' stawów');
ok('przycisk przełączania istnieje', !!d.getElementById('frogSwitchPondBtn'));
const first = w.eval('frogMapId');
w.frogSwitchPond();
const second = w.eval('frogMapId');
ok('staw się zmienił', first !== second, first+' → '+second);
const start = w.eval('frogMapId');
for (let k = 0; k < all; k++) w.frogSwitchPond();
ok('cykl wraca do początku po ' + all + ' przełączeniach', w.eval('frogMapId') === start, start + ' → ' + w.eval('frogMapId'));
const visited = new Set();
for (let k = 0; k < all; k++) { w.frogSwitchPond(); visited.add(w.eval('frogMapId')); }
ok('odwiedza wszystkie stawy', visited.size === all, visited.size + '/' + all);
ok('przełączanie nie wywala', errs.length===0, errs.slice(0,2).join('|')||'brak');

// Regresja: własna mapa z edytora nie dostawała pola stopPad, które czyta
// rysowanie liścia STOP. Każdy własny staw ma górny wiersz-ścianę (same STOP),
// więc frogDraw() rzucał TypeError, a frogStart() przerywał przed włączeniem
// pętli gry — staw dało się narysować, ale nie dało się na nim zagrać.
console.log('=== gra na własnej mapie z edytora ===');
w.frogCloseEditor();
w.frogLocalSet('osiedle_frog_view3d', 0);   // rysujemy w 2D (jak domyślnie)
w.frogMapEditorOpen(null);
d.getElementById('frogEdName').value = 'Staw testowy';
d.getElementById('frogEdCols').value = '8';
d.getElementById('frogEdRows').value = '10';
d.getElementById('frogEdFood').value = '0';  // suchy staw: 0% musi zostać 0%
w.frogEdReadControls();
const ed = w.eval('JSON.parse(JSON.stringify(frogEd))');
ok('edytor przyjmuje rozmiar', ed.cols===8 && ed.rows===10, ed.cols+'×'+ed.rows);
ok('0% jedzenia zostaje 0%', ed.foodPct===0, 'foodPct='+ed.foodPct);

w.frogEdSave();
const saved = w.eval('frogMap()');
ok('mapa zapisana i wybrana', saved.custom===true && saved.id===w.eval('frogMapId'), saved.name);
ok('mapa ma komplet pól rysowania', Array.isArray(saved.stopPad) && saved.stopPad.length===2,
   JSON.stringify(saved.stopPad));
ok('suchy staw zapisuje się jako 0%', saved.foodPct===0, 'foodPct='+saved.foodPct);

// STOP w środku stawu + kamera na górze, żeby rysowanie sięgnęło ściany z STOP
w.eval("frogEd.cells = 's'.repeat(frogEd.cols * frogEd.rows)");
w.frogEdSave();
ok('mapa z samym STOP zapisana', w.eval('frogMap().cells').includes('s'));
let drew = null;
try { w.eval('frogCam.x = 0; frogCam.y = 0; frogDraw();'); }
catch (e) { drew = e; }
ok('rysowanie stawu z STOP nie wywala się', !drew, drew ? drew.message : 'brak wyjątku');

// właściwy sprawdzian: po zapisie da się wskoczyć na staw i grać
const btn = [...d.querySelectorAll('#frogMapEditor button')].find(b => /Zapisz i graj/.test(b.textContent));
ok('jest przycisk „Zapisz i graj”', !!btn, btn ? btn.textContent.trim() : 'brak');
w.eval("frogEd.cells = 'p'.repeat(frogEd.cols * frogEd.rows)");
w.frogEdSave(true);
ok('edytor zamyka się po zapisie', d.getElementById('frogMapEditor').classList.contains('hidden'));
ok('gra się włącza', w.eval('frogState')==='play', 'state='+w.eval('frogState'));
ok('pętla gry działa', !!w.eval('frogAnim'), 'frogAnim='+w.eval('frogAnim'));
ok('żaba stoi na starcie', w.eval('frog.alive')===true && w.eval('frog.row')===w.eval('frogStartRow()'),
   'row='+w.eval('frog.row'));

const hop = w.eval(`(() => {
  frogActorJump(frog, frogSpawnCol(0), frogStartRow() - 1);
  frogMoveActor(frog, 0.5, true);          // skok trwa 0.36 s
  return { row: frog.row, col: frog.col, alive: frog.alive, score: frog.score };
})()`);
ok('skok w górę działa na własnej mapie',
   hop.row===w.eval('frogStartRow()')-1 && hop.alive===true, JSON.stringify(hop));
ok('po skoku można iść dalej do mety', w.eval('frogEdCanWin(JSON.parse(JSON.stringify(frogMap())))'));
ok('gra na własnej mapie nie wywala', errs.length===0, errs.slice(0,2).join('|')||'brak');

// przycisk „🆕 Nowa” wcześniej tylko tworzył mapę i nic nie wstawiał do edytora
const oldEd = w.eval('frogEd && frogEd.id');
w.frogEdNewMap();
ok('„Nowa” wstawia świeżą mapę', !!w.eval('frogEd') && w.eval('frogEd.id')!==oldEd,
   oldEd+' → '+w.eval('frogEd && frogEd.id'));
w.frogEdClose();

// Druga regresja: cleanConfig() sprawdzało config.custom, ale czytało cols/cells
// z samego config. Żadna własna mapa nie przechodziła więc walidacji i gość
// dostawał staw bez własnej siatki — na wspólnym stawie nie dało się zagrać.
console.log('=== własna mapa we wspólnym stawie ===');
const { default: frogRoom } = await import('../api/frog-room.js');
async function room(cfg, id) {
  const res = { setHeader(){}, status(){return this;}, json(o){this.body=o;return this;}, end(){return this;} };
  await frogRoom({ method:'POST', body:{ action:'create', id, token:'t'+id, nick:'Gracz', config:cfg }, query:{} }, res);
  return res.body.room.config;
}
const base = { cols:8, rows:10, cells:'p'.repeat(80), goals:[6,7], spawns:[7], bots:0, foodPct:0, padColor:'#5fb84a' };
const got = await room({ race:false, custom:{ ...base, id:'cm_a', name:'Suchy staw' } }, 'pA');
ok('serwer przepuszcza własną mapę', !!got.custom, JSON.stringify(got.custom ? got.custom.cols+'×'+got.custom.rows : got));
ok('siatka w całości', got.custom && got.custom.cells.length===80, got.custom && got.custom.cells.length);
ok('meta i starty', JSON.stringify(got.custom?.goals)==='[6,7]' && JSON.stringify(got.custom?.spawns)==='[7]',
   JSON.stringify(got.custom?.goals)+' / '+JSON.stringify(got.custom?.spawns));
ok('suchy staw zostaje suchym (0%)', got.custom && got.custom.foodPct===0, 'foodPct='+got.custom?.foodPct);
const empty = await room({ custom:{ cols:8, rows:10, cells:'p'.repeat(80) } }, 'pB');
ok('brakujące ustawienia dostają wartości zapasowe', empty.custom?.foodPct===100 && empty.custom?.bots===0,
   'foodPct='+empty.custom?.foodPct+' bots='+empty.custom?.bots);
const bad = await room({ custom:{ ...base, cells:'p'.repeat(10) } }, 'pC');
ok('uszkodzona siatka nie wchodzi do pokoju', !bad.custom, JSON.stringify(bad));

// mapa z serwera musi być grywalna tak samo jak lokalna.
// Uwaga: te zmienne są `let` na poziomie skryptu, więc przypisujemy je przez
// eval — właściwość obiektu window to zupełnie inny slot. Do eval idzie
// literał obiektu, nie JSON w cudzysłowie: frogFixMap() obiektu nie parsuje.
w.eval('frogSharedMap = frogFixMap(' + JSON.stringify(got.custom) + ')');
let shared = null;
try { w.eval('frogMapSelect(frogSharedMap.id); frogCamClamp(true); frogStart(); frogDraw();'); }
catch (e) { shared = e; }
ok('gość renderuje mapę właściciela', !shared, shared ? shared.message : 'brak wyjątku');
ok('to ta sama siatka co u właściciela', w.eval('frogMap().cols')===8 && w.eval('frogMap().rows')===10,
   w.eval('frogMap().cols')+'×'+w.eval('frogMap().rows'));
ok('na mapie właściciela da się skoczyć',
   w.eval('(() => { frogActorJump(frog, frogSpawnCol(0), frogStartRow()-1); frogMoveActor(frog, 0.5, true); return frog.row === frogStartRow()-1; })()'),
   'row='+w.eval('frog.row')+' (start '+w.eval('frogStartRow()')+')');
w.eval('frogSharedMap = null; frogRoomLeaveLocal(); frogStop();');
ok('wspólny staw nie wywala', errs.length===0, errs.slice(0,2).join('|')||'brak');

console.log(F?`\n✗ BŁĘDÓW: ${F}`:'\n✓ RZABKA OK');
process.exit(F ? 1 : 0);
