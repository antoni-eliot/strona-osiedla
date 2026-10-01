// Vercel Serverless - trwały magazyn danych (tablica, koncerty, ogłoszenia, konta, wyniki)
// UWAGA: na Vercel magazyn jest w pamięci jednej instancji (jak send-activation).
// Do prawdziwej trwałości między instancjami użyj Vercel KV / Redis / bazy danych.
// Lokalnie dane trwale zapisuje server.js do pliku data.json.

const store = globalThis.__dataStore || (globalThis.__dataStore = new Map());
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const out = {};
    for (const k of SYNC_KEYS) if (store.has(k)) out[k] = store.get(k);
    return res.status(200).json(out);
  }

  if (req.method === 'POST') {
    const { key, value } = req.body || {};
    if (!SYNC_KEYS.includes(key)) return res.status(400).json({ error: 'Nieznany klucz: ' + key });
    if (!Array.isArray(value)) return res.status(400).json({ error: 'value musi być tablicą' });
    store.set(key, value);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}