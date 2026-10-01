// Vercel Serverless Function - aktywacja konta po kliknięciu linku (?activate=TOKEN)
const store = globalThis.__activationStore || (globalThis.__activationStore = new Map());

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Brak tokenu aktywacyjnego' });

  const entry = store.get(token);
  if (!entry) return res.status(400).json({ error: 'Nieprawidłowy lub wygasły link' });
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return res.status(400).json({ error: 'Link wygasł. Poproś o nowy.' });
  }

  store.delete(token);
  return res.status(200).json({ ok: true, email: entry.email, message: 'Konto aktywowane' });
}