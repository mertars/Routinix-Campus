// Video Ders Merkezi — TEK SEFERLİK kurulum script'i. YOUTUBE_CLIENT_ID ve
// YOUTUBE_CLIENT_SECRET'ı (Google Cloud Console > Credentials'tan) alıp bir
// kalıcı YOUTUBE_REFRESH_TOKEN üretir — bu token, uygulamanın her video
// yüklemesinde yeni bir "erişim anahtarı" almak için kullanılır (bkz.
// lib/server/youtube.ts). Çalıştırma:
//   npx tsx --env-file=.env.local scripts/youtube-oauth-setup.mjs
// (YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET önce .env.local'e eklenmeli.)
import http from "node:http";
import { URL } from "node:url";

const PORT = 8085;
const REDIRECT_URI = `http://localhost:${PORT}/oauth/callback`;
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("YOUTUBE_CLIENT_ID ve YOUTUBE_CLIENT_SECRET .env.local'de tanımlı olmalı.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload");
// access_type=offline + prompt=consent — refresh_token SADECE bu ikisi
// birlikteyken dönüyor (aksi halde sadece kısa ömürlü access_token gelir).
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nAşağıdaki linki taraycıda aç ve videoların yükleneceği YouTube hesabıyla giriş yap:\n");
console.log(authUrl.toString());
console.log(`\n(localhost:${PORT} üzerinde onayını bekliyorum...)\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/oauth/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Kod alınamadı.");
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      throw new Error(`Token değişimi başarısız: ${JSON.stringify(data)}`);
    }

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("Tamamlandı! Terminale dönebilirsin.");
    console.log("\n✔ Başarılı — bu satırı .env.local'e ekle:\n");
    console.log(`YOUTUBE_REFRESH_TOKEN="${data.refresh_token}"\n`);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Hata oluştu, terminale bak.");
    console.error("Hata:", error instanceof Error ? error.message : error);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT);
