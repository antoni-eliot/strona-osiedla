// Vercel Serverless - pokoje gry Żabka (multiplayer)
// Każdy pokój to jeden staw: właściciel ustala mapę i startuje wyścig,
// a goście dołączają kodem i widzą tę samą grę.
//
// WAŻNE dla bezpieczeństwa: każdy członek pokarmu dostaje własny token przy
// dołączeniu. Bez niego nikt nie zmieni ustawień stawu ani nikogo nie zbanuje —
// ban i zmiana mapy są zastrzeżone dla właściciela, a serwer to sprawdza.
//
// UWAGA: na Vercel magazyn jest w pamięci jednej instancji (jak data.js), więc
// pokoje znikają po restarcie i dwie instancje ich nie widzą. Lokalnie
// server.js podstawia trwały magazyn plikowy (patrz setStore poniżej).

const MEMBER_LIMIT = 8;            // ilu graczy mieści się na stawie
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;   // pokój bez akcji ginie po 2 godzinach
const MAX_CELLS = 30 * 40;        // największa siatka, jaką przyjmujemy od właściciela
const MAX_CMDS = 40;               // ile skoków czekających trzymamy w kolejce
const CMD_TTL_MS = 4000;           // starsze niż tyle skoki przepadają
// alfabet bez mylących znaków (0/O, 1/I) — kod ma być przeczytany na głos
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// magazyn: domyślnie pamięć instancji (Vercel), opcjonalnie podmieniany przez server.js
let store = globalThis.__frogRoomStore || (globalThis.__frogRoomStore = new Map());
let persist = null;                // (Map) => void — wpięte przez server.js

export function setStore(map, onSave) { store = map; persist = onSave || null; }
function save() { if (persist) { try { persist(store); } catch { /* zapis nie jest krytyczny */ } } }

const now = () => Date.now();
const token = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

function newCode() {
  for (let attempt = 0; attempt < 40; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!store.has(code)) return code;
  }
  return null;                     // brak wolnego kodu po 40 próbach
}

// wyrzucamy pokoje, do których nikt się nie zagląda
function gc() {
  const t = now();
  let dirty = false;
  for (const [code, r] of store) if (t - r.updated > ROOM_TTL_MS) { store.delete(code); dirty = true; }
  if (dirty) save();
}

function cleanNick(v) { return String(v || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Żabka'; }

// konfiguracja stawu od właściciela: bierzemy tylko to, co rozumiemy, i trzymamy
// w limicie, żeby gracz nie wcisnął serwerowi 10 MB siatki
function cleanConfig(input) {
  const c = input && typeof input === 'object' ? input : {};
  const out = { race: !!c.race };
  if (typeof c.mapId === 'string') out.mapId = c.mapId.slice(0, 40);
  if (c.custom && typeof c === 'object') {
    const cols = Math.round(Number(c.cols)), rows = Math.round(Number(c.rows));
    if (cols >= 6 && cols <= 30 && rows >= 8 && rows <= 40 && cols * rows <= MAX_CELLS) {
      const cells = String(c.cells || '').replace(/[^pws]/g, '');
      if (cells.length === cols * rows) {
        out.custom = {
          id: String(c.id || 'cm_shared').slice(0, 40),
          name: String(c.name || 'Staw właściciela').slice(0, 24),
          cols, rows, cells,
          goals: (Array.isArray(c.goals) ? c.goals : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < cols),
          spawns: (Array.isArray(c.spawns) ? c.spawns : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < cols),
          foodPct: Math.max(0, Math.min(200, Math.round(Number(c.foodPct) || 100))),
          padColor: /^#[0-9a-fA-F]{6}$/.test(c.padColor) ? c.padColor : '#5fb84a',
          bots: Math.max(0, Math.min(7, Math.round(Number(c.bots) || 0))),
          botNicks: (Array.isArray(c.botNicks) ? c.botNicks : []).map(cleanNick).slice(0, 7),
          race: out.race
        };
        if (!out.custom.goals.length) out.custom.goals = [Math.floor(cols / 2)];
        if (!out.custom.spawns.length) out.custom.spawns = [Math.floor(cols / 2)];
        if (!out.custom.botNicks.length) out.custom.botNicks = ['Żabek', 'Kumpla', 'Gruszka'].slice(0, out.custom.bots);
      }
    }
  }
  return out;
}

// publiczny widok pokoju: tokeny wychodzą tylko do właściciela
function publicRoom(r) {
  return {
    code: r.code,
    owner: r.owner,
    started: r.started,
    updated: r.updated,
    config: r.config,
    state: r.state,
    cmds: r.cmds,
    members: Object.values(r.members).map(m => ({
      id: m.id, nick: m.nick, skin: m.skin, banned: m.banned, owner: m.id === r.owner, seen: m.seen
    }))
  };
}

// czy ta osoba jest w pokoju i ma właściwy token (albo jest właścicielem)
function memberOf(r, id, tok) {
  const m = r && id ? r.members[id] : null;
  if (!m || !tok || m.token !== tok) return null;
  return m;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  gc();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const q = (req.query && typeof req.query === 'object') ? req.query : {};
  const action = String(body.action || q.action || '');
  const code = String(body.code || q.code || '').toUpperCase().trim();
  const id = String(body.id || q.id || '').slice(0, 40);
  const tok = String(body.token || q.token || '').slice(0, 40);

  // --- odczyt: gość pyta o stan stawu i o skoki do wykonania ---
  if (action === 'state') {
    const r = store.get(code);
    if (!r) return res.status(404).json({ error: 'Nie ma takiego stawu' });
    r.updated = now();
    const me = memberOf(r, id, tok);
    if (!me) return res.status(403).json({ error: 'Nie jesteś w tym pokoju' });
    me.seen = now();
    if (me.banned) return res.status(403).json({ error: 'Zbanowano Cię na tym stawie', banned: true });
    // skoki starsze niż CMD_TTL_MS wypadają, bo gracz mógł rozłączyć się w trakcie
    r.cmds = r.cmds.filter(c => now() - c.at < CMD_TTL_MS).slice(-MAX_CMDS);
    save();
    return res.status(200).json({ ok: true, you: me.id, owner: r.owner, room: publicRoom(r) });
  }

  // --- założenie stawu: twórca od razu zostaje właścicielem ---
  if (action === 'create') {
    const fresh = newCode();
    if (!fresh) return res.status(503).json({ error: 'Wszystkie kody zajęte, spróbuj za chwilę' });
    const member = { id, nick: cleanNick(body.nick), skin: String(body.skin || '').slice(0, 20), token: tok || token(), banned: false, joined: now(), seen: now() };
    const room = {
      code: fresh, owner: id, created: now(), updated: now(),
      config: cleanConfig(body.config), members: { [id]: member },
      state: null, cmds: [], started: false
    };
    store.set(fresh, room);
    save();
    return res.status(200).json({ ok: true, code: fresh, token: member.token, room: publicRoom(room) });
  }

  const room = store.get(code);
  if (!room) return res.status(404).json({ error: 'Nie ma takiego stawu' });
  const me = memberOf(room, id, tok);
  room.updated = now();
  if (me) me.seen = now();
  const isOwner = !!me && room.owner === id;

  // --- dołączenie ---
  if (action === 'join') {
    if (me) return res.status(200).json({ ok: true, code, token: me.token, room: publicRoom(room) });
    // Ban trzymamy po id (nik wraca z powrotem) i po nicku (bo id da się wygenerować
    // od nowa w innej przeglądarce). To blokada kulturalna, nie kryptograficzna —
    // serwer nie zna prawdziwego konta, bo logowanie jest w całym osiedlu fikcją.
    const wanted = cleanNick(body.nick);
    const known = Object.values(room.members);
    if (room.bannedIds?.[id] || known.some(m => m.banned && m.nick === wanted))
      return res.status(403).json({ error: 'Ten nick jest zbanowany na tym stawie' });
    if (known.length >= MEMBER_LIMIT)
      return res.status(409).json({ error: `Staw jest pełny (${MEMBER_LIMIT} graczy)` });
    const member = { id, nick: wanted, skin: String(body.skin || '').slice(0, 20), token: tok || token(), banned: false, joined: now(), seen: now() };
    room.members[id] = member;
    save();
    return res.status(200).json({ ok: true, code, token: member.token, room: publicRoom(room) });
  }

  if (!me) return res.status(403).json({ error: 'Nie jesteś w tym pokoju' });
  if (me.banned) return res.status(403).json({ error: 'Jesteś zbanowany na tym stawie' });

  // --- skok: intencja dla właściciela, który prowadzi symulację ---
  if (action === 'cmd') {
    const c = Math.round(Number(body.c)), r = Math.round(Number(body.r));
    if (!Number.isInteger(c) || !Number.isInteger(r)) return res.status(400).json({ error: 'złe polecenie' });
    room.cmds.push({ id, c, r, at: now() });
    room.cmds = room.cmds.slice(-MAX_CMDS);
    save();
    return res.status(200).json({ ok: true });
  }

  // --- właściciel wystawia stan stawu (pozycje żab, jedzenia, wyniki) ---
  if (action === 'push') {
    if (!isOwner) return res.status(403).json({ error: 'Tylko właściciel prowadzi staw' });
    const frogs = Array.isArray(body.frogs) ? body.frogs.slice(0, MEMBER_LIMIT + 8) : [];
    room.state = { at: now(), frogs, won: body.won ? String(body.won).slice(0, 24) : null };
    room.cmds = [];                // intencje przyjęte — nie wracają do kolejki
    save();
    return res.status(200).json({ ok: true });
  }

  if (!isOwner) return res.status(403).json({ error: 'To zarezerwowane dla właściciela stawu' });

  // --- dalej: tylko właściciel ---
  if (action === 'config') {
    room.config = cleanConfig(body.config);
    room.state = null;
    room.started = false;
    save();
    return res.status(200).json({ ok: true, room: publicRoom(room) });
  }
  if (action === 'start') {
    room.started = true;
    room.state = null;
    save();
    return res.status(200).json({ ok: true, room: publicRoom(room) });
  }
  if (action === 'ban') {
    const target = room.members[String(body.target || '')];
    if (!target) return res.status(404).json({ error: 'Nie ma takiego gracza' });
    if (target.id === room.owner) return res.status(400).json({ error: 'Właściciela stawu nie da się zbanować' });
    const on = body.on !== false;
    target.banned = on;
    room.bannedIds = room.bannedIds || {};
    if (on) room.bannedIds[target.id] = now(); else delete room.bannedIds[target.id];
    save();
    return res.status(200).json({ ok: true, room: publicRoom(room) });
  }
  if (action === 'close') {
    store.delete(code);
    save();
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Nieznana akcja: ' + action });
}
