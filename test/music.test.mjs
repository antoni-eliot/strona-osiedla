// Regresja: muzyka - syntezator + osadzony odtwarzacz YouTube.
// Uruchom: npm test  (wymaga: npm install)
import fs from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>{const m=String(e.message||'');if(!/Not implemented/.test(m))errs.push(m);});
const c=new Proxy({},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true;}});
c.measureText=()=>({width:10});c.createLinearGradient=()=>({addColorStop:()=>{}});c.createRadialGradient=()=>({addColorStop:()=>{}});
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost:3000/',virtualConsole:vc});
const w=dom.window,d=w.document;
w.HTMLCanvasElement.prototype.getContext=()=>c;
w.fetch=()=>Promise.reject(new Error('offline'));
w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),16);
w.cancelAnimationFrame=id=>clearTimeout(id);
let F=0;const ok=(l,cc,x)=>{console.log((cc?'  PASS  ':'  FAIL  ')+l+(x!==undefined?'  → '+x:''));if(!cc)F++;};
ok('opcja YouTube w menu', [...d.getElementById('musicType').options].some(o=>o.value==='yt-sleep'));
ok('ID filmu z linku', w.eval('YT_SLEEP_VIDEO')==='yzEEyPPbftU', w.eval('YT_SLEEP_VIDEO'));
ok('start 340s z linku (t=340s)', w.eval('YT_SLEEP_START')===340);
ok('kontener odtwarzacza ukryty na starcie', d.getElementById('ytHost').style.display==='none');
ok('nic nie ładuje się na starcie', !d.querySelector('script[src*="youtube"]'));
w.changeMusicType('yt-sleep');
ok('wybranie YT nie włącza odtwarzacza bez kliknięcia', d.getElementById('ytHost').style.display==='none');
w.musicPlay();
ok('kliknięcie Play odsłania odtwarzacz', d.getElementById('ytHost').style.display==='block');
const s=d.querySelector('script[src*="iframe_api"]');
ok('API YouTube ładuje się leniwie', !!s, s?.src);
ok('link do źródła jest bezpieczny', (d.querySelector('#ytNote a')?.rel||'').includes('noopener'), d.querySelector('#ytNote a')?.getAttribute('href'));
// powrót do syntezatora czyści wszystko
Object.defineProperty(w,'YT',{value:{Player:function(){this.playVideo=()=>{};this.stopVideo=()=>{};}},writable:true});
w.changeMusicType('chill');
ok('powrót do syntezatora czyści player', w.eval('ytPlayer')===null);
ok('kontener znika po zmianie utworu', d.getElementById('ytHost').style.display==='none');
w.changeMusicType('yt-sleep'); w.musicPlay();
ok('drugi raz YT buduje player', !!d.getElementById('ytPlayer'), d.getElementById('ytHost').innerHTML.slice(0,60));
w.musicStop();
ok('brak błędów', errs.length===0, errs.slice(0,2).join('|')||'brak');
console.log(F?`\n✗ BŁĘDÓW: ${F}`:'\n✓ YOUTUBE OK');
process.exit(F ? 1 : 0);
