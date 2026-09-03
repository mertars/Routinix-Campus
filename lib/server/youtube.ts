// Video Ders Merkezi — kullanıcı kararı (2026-09-03, ikinci geçiş): yönetici
// dosyayı BİZİM panelimize yükler, biz arka planda YouTube'a (gizli/liste
// dışı) aktarırız — kullanıcı hiç YouTube görmez. Bir kez alınan OAuth2
// "refresh token" (bkz. scripts/youtube-oauth-setup.mjs) kalıcı olarak
// saklanır, her yüklemede ondan taze bir "access token" türetilir (Google'ın
// standart OAuth2 refresh akışı — access token'lar ~1 saatte sona erer,
// refresh token süresiz kullanılabilir, elle iptal edilene kadar).
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ortam değişkeni tanımlı değil — Video Ders Merkezi'nin YouTube yüklemesi için gerekli.`);
  return value;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.accessToken;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("YOUTUBE_CLIENT_ID"),
      client_secret: requireEnv("YOUTUBE_CLIENT_SECRET"),
      refresh_token: requireEnv("YOUTUBE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`YouTube erişim anahtarı yenilenemedi (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

// "Eğitim" kategorisi — YouTube'un sabit categoryId listesindeki değer,
// tüm YouTube hesapları için AYNI (bölgeye/kanala göre değişmez).
const EDUCATION_CATEGORY_ID = "27";

export async function uploadToYoutube(params: {
  title: string;
  description: string;
  body: ReadableStream;
  contentLength: number;
  contentType: string;
}): Promise<string> {
  const accessToken = await getAccessToken();

  // 1) Resumable yükleme oturumu başlat — Google bir oturum URL'si döner
  // (Location header), asıl bayt akışı BUNA gönderilir.
  const initRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": params.contentType,
      "X-Upload-Content-Length": String(params.contentLength),
    },
    body: JSON.stringify({
      snippet: { title: params.title, description: params.description, categoryId: EDUCATION_CATEGORY_ID },
      status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
    }),
  });
  if (!initRes.ok) throw new Error(`YouTube yükleme oturumu başlatılamadı (${initRes.status}): ${await initRes.text()}`);
  const sessionUrl = initRes.headers.get("location");
  if (!sessionUrl) throw new Error("YouTube yükleme oturumu adresi alınamadı.");

  // 2) Asıl video baytlarını R2'den OKUYARAK (bellekte tutmadan) doğrudan
  // bu oturuma AKIT — duplex:"half" Node'un fetch'inde stream gövde
  // göndermek için gerekli.
  const uploadRes = await fetch(sessionUrl, {
    method: "PUT",
    headers: { "Content-Type": params.contentType, "Content-Length": String(params.contentLength) },
    body: params.body,
    // @ts-expect-error -- Node'un fetch'i (undici) stream gövdeler için duplex ister, DOM'un Fetch tipinde henüz yok
    duplex: "half",
  });
  if (!uploadRes.ok) throw new Error(`YouTube video yüklemesi başarısız (${uploadRes.status}): ${await uploadRes.text()}`);
  const created = (await uploadRes.json()) as { id: string };
  return created.id;
}

// Kullanıcı geri bildirimi (2026-09-04) — YouTube'un video BAYTLARINI
// ALMASI ile videonun GERÇEKTEN oynatılabilir olması AYRI şeyler; bayt
// alımı bitince YouTube kendi tarafında ayrı bir "işleme" adımı yapar
// (saniyeler-dakikalar sürebilir). Bu, o adımın bitip bitmediğini kontrol
// eder — Video.status alanı bu bitene kadar "PROCESSING" kalır (bkz.
// app/api/videos/route.ts > handleGet, kart bu bitmeden kilitli tutulur).
export async function checkYoutubeProcessingStatus(youtubeId: string): Promise<"PROCESSING" | "READY" | "FAILED"> {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(youtubeId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "PROCESSING";
  const data = (await res.json()) as {
    items?: { status?: { uploadStatus?: string }; processingDetails?: { processingStatus?: string } }[];
  };
  const item = data.items?.[0];
  if (!item) return "PROCESSING";
  const uploadStatus = item.status?.uploadStatus;
  const processingStatus = item.processingDetails?.processingStatus;
  if (uploadStatus === "failed" || uploadStatus === "rejected" || processingStatus === "failed" || processingStatus === "terminated") return "FAILED";
  if (uploadStatus === "processed" || processingStatus === "succeeded" || (uploadStatus === "uploaded" && !processingStatus)) return "READY";
  return "PROCESSING";
}
