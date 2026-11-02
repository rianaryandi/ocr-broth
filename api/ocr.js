// Proxy OCR.space untuk tool Broth Control.
// Cara pakai: repo GitHub baru berisi SATU file ini (api/ocr.js), import ke Vercel
// sebagai project terpisah, lalu set env OCR_SPACE_API_KEY di project tersebut.
// broth.html (di masgex.vercel.app) memanggil https://<project>.vercel.app/api/ocr
// — HP tidak lagi menyentuh api.ocr.space langsung, jadi tidak butuh VPN dan
// tidak ada API key di frontend publik.
//
// Kenapa project terpisah: repo HRD2 sudah 12/12 function di paket Hobby —
// menaruh file ini di sana membuat deploy gagal lagi (terbukti 2 Nov 2026).

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OCR_SPACE_API_KEY belum di-set di Vercel env project ini' });
    return;
  }
  try {
    // Teruskan multipart body apa adanya ke OCR.space
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const ctype = req.headers['content-type'] || '';

    // apikey + parameter OCR via query string (OCR.space mendukung ini),
    // jadi frontend tidak perlu mengirim/menyimpan key sama sekali.
    const url = 'https://api.ocr.space/parse/image?apikey=' + encodeURIComponent(apiKey)
      + '&language=eng&isOverlayRequired=false&scale=true&OCREngine=2';

    const up = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': ctype },
      body: body,
    });
    const data = await up.json();
    // Mode redirect (tanpa fetch): kirim teks mentah OCR via hash URL kembali ke broth.html.
    // Dipakai karena fetch() diblokir sistematis di HP Rian (terbukti 2-3 Nov 2026).
    // Cara pakai: POST ke /api/ocr?redirect=https://masgex.vercel.app/broth.html
    var redirectTo = req.query && req.query.redirect;
    // Vercel: query bisa juga di req.url
    if (!redirectTo && req.url) {
      var m = req.url.match(/[?&]redirect=([^&]+)/);
      if (m) redirectTo = decodeURIComponent(m[1]);
    }
    if (redirectTo) {
      var pr = (data.ParsedResults && data.ParsedResults[0]) || {};
      var rawText = pr.ParsedText || '';
      // Validasi redirect hanya ke masgex.vercel.app (anti open-redirect)
      if (!/^https:\/\/masgex\.vercel\.app\//.test(redirectTo)) {
        res.status(400).json({ error: 'redirect tidak diizinkan' });
        return;
      }
      var dest = redirectTo + '#ocr=' + encodeURIComponent(rawText);
      res.writeHead(302, { Location: dest });
      res.end();
      return;
    }
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Proxy OCR gagal: ' + (e.message || e) });
  }
}

export const config = { api: { bodyParser: false } };
