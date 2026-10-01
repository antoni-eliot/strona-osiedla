// Lokalny serwer do testów w WSL - uruchamia te same funkcje api/* co Vercel
// Użycie: node server.js  ->  http://localhost:3000
// Wymaga: Node 18+ (global fetch). Czytuje token z .env (RESEND_TOKEN/RESEND_API_KEY).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sendActivation from './api/send-activation.js';
import activate from './api/activate.js';
import login from './api/login.js';
import frogRoom, { setStore as setFrogRoomStore } from './api/frog-room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// wczytaj .env (Node nie robi tego sam; dotenv niepotrzebny)
if (fs.existsSync(path.join(__dirname, '.env'))) {
  for (const rawLine of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
  console.log('[server.js] .env załadowany');
  if (process.env.SITE_URL) console.log('[server.js] SITE_URL =', process.env.SITE_URL);
}

const PORT = process.env.PORT || 3000;

// --- Trwały magazyn danych (data.json) ---
// Dane tablicy, koncertów, ogłoszeń, kont i wyników są zapisywane na dysku,
// więc przetrwają restart serwera / zamknięcie przeglądarki.
const DATA_FILE = path.join(__dirname, 'data.json');
const SYNC_KEYS = [
  'osiedle_users',
  'osiedle_messages',
  'osiedle_concerts',
  'osiedle_market',
  'osiedle_jump_board',
  'osiedle_maze_board',
  'osiedle_tickets',
  'osiedle_pixel_art',
  'osiedle_photos',
  'osiedle_presence',
  'osiedle_theme',
];
let dataJson = {};
function loadDataFile() {
  try { dataJson = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { dataJson = {}; }
}
function saveDataFile() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(dataJson, null, 2)); }
  catch (e) { console.error('[server.js] błąd zapisu data.json:', e.message); }
}
loadDataFile();

// --- Trwały magazyn pokojów gry Żabka (rooms.json) ---
// Pokoje multiplayerowe nie mieszczą się w data.json (to obiekty, nie tablice
// jak w SYNC_KEYS), więc mają osobny plik i osobny format: Map<code, pokój>.
const ROOMS_FILE = path.join(__dirname, 'rooms.json');
let roomsJson = new Map();
try {
  const raw = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'));
  if (raw && typeof raw === 'object') roomsJson = new Map(Object.entries(raw));
} catch { roomsJson = new Map(); }
function saveRoomsFile() {
  try { fs.writeFileSync(ROOMS_FILE, JSON.stringify(Object.fromEntries(roomsJson), null, 2)); }
  catch (e) { console.error('[server.js] błąd zapisu rooms.json:', e.message); }
}
setFrogRoomStore(roomsJson, saveRoomsFile);   // api/frog-room.js zapisuje przez to

function dataApi(req, res) {
  if (req.method === 'GET') {
    const out = {};
    for (const k of SYNC_KEYS) if (k in dataJson) out[k] = dataJson[k];
    return res.json(out);
  }
  if (req.method === 'POST') {
    const { key, value } = req.body || {};
    if (!SYNC_KEYS.includes(key)) return res.status(400).json({ error: 'Nieznany klucz: ' + key });
    if (!Array.isArray(value)) return res.status(400).json({ error: 'value musi być tablicą' });
    dataJson[key] = value;
    saveDataFile();
    return res.json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

const route = {
  '/api/send-activation': sendActivation,
  '/api/activate': activate,
  '/api/login': login,
  '/api/data': dataApi,
  '/api/frog-room': frogRoom,
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/')) {
    req.body = await readBody(req);
    const sRes = {
      _status: 200,
      _headers: {},
      setHeader(k, v) { this._headers[k] = v; },
      status(c) { this._status = c; return this; },
      json(obj) {
        for (const [k, v] of Object.entries(this._headers)) res.setHeader(k, v);
        res.writeHead(this._status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      },
      end() { res.end(); },
    };
    const handler = route[url.pathname];
    if (handler) return handler(req, sRes);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let filePath = path.join(__dirname, decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname));
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Strona osiedla działa na http://localhost:${PORT}`);
});