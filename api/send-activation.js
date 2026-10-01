// Vercel Serverless Function - wysyłka linku aktywacyjnego konta na e-mail
// Używa Resend (https://resend.com) - env: RESEND_TOKEN (lub RESEND_API_KEY), FROM_EMAIL, SITE_URL
// Brak klucza = tryb demo (link zwracany w odpowiedzi, nie wysyłany)

// Prosty store w pamięci - dla multi-instance zamień na Vercel KV / Redis / DB
const store = globalThis.__activationStore || (globalThis.__activationStore = new Map());

function makeToken() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Podaj poprawny e-mail' });
  }

  const token = makeToken();
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 godzina
  const key = email.toLowerCase();

  // usuń stare tokeny dla tego e-maila
  for (const [t, e] of store.entries()) {
    if (e.email === key) store.delete(t);
  }
  store.set(token, { email: key, expiresAt });

  const baseUrl = (process.env.SITE_URL || req.headers.origin || 'http://localhost:3000').replace(/\/$/, '');
  const link = `${baseUrl}?activate=${token}`;
  console.log(`[send-activation] ${key} -> ${link}`);

  const apiKey = process.env.RESEND_TOKEN || process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    // tryb demo bez wysyłki
    console.warn('RESEND_TOKEN brak - tryb demo, link w odpowiedzi');
    return res.status(200).json({
      ok: true,
      demo: true,
      link,
      token,
      message: `Link demo: ${link}`
    });
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: 'Aktywuj konto - strona osiedla',
        html: `
          <div style="font-family:sans-serif; max-width:480px; margin:0 auto;">
            <h2 style="color:#111827;">Aktywuj swoje konto</h2>
            <p style="color:#374151;">Witaj! Kliknij poniższy przycisk, aby aktywować konto na stronie osiedla:</p>
            <p style="text-align:center; margin:24px 0;">
              <a href="${link}" style="display:inline-block; background:#ff7a00; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700;">Aktywuj konto</a>
            </p>
            <p style="color:#6b7280; font-size:13px;">Link ważny 1 godzinę. Jeśli to nie Ty, zignoruj wiadomość.</p>
            <p style="color:#9ca3af; font-size:11px;">awangarda • strona osiedla</p>
          </div>
        `
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('Resend error', data);
      return res.status(500).json({ error: 'Błąd wysyłki e-maila', details: data });
    }

    return res.status(200).json({ ok: true, message: 'Link aktywacyjny wysłany na e-mail', id: data.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Błąd serwera', details: e.message });
  }
}