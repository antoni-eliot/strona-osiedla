// Vercel Serverless - logowanie, weryfikacja hasła admina
// Hasło admina w env ADMIN_PASSWORD (ustaw w Vercel)
// Nigdy nie zwraca hasła do klienta

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Podaj hasło' });

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return res.status(500).json({ error: 'ADMIN_PASSWORD nie ustawione' });

  // admin
  if (password === adminPassword) {
    return res.status(200).json({ ok: true, isAdmin: true });
  }

  // demo: zwykły user - w prod sprawdź w DB
  // tu akceptujemy każde inne hasło jako usera (jeśli masz DB, sprawdź)
  // Jeśli chcesz tylko admina, zwróć błąd dla nie-admina:
  // return res.status(401).json({ error: 'Nieprawidłowe hasło' });

  return res.status(200).json({ ok: true, isAdmin: false });
}
