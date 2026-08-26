// Tüm API route'larına (bkz. lib/logger.ts > withApiLogging) uygulanan kaba
// bir güvenlik ağı — amaç ince taneli kullanıcı kısıtlaması DEĞİL, döngüye
// giren bir script/bot/kaba-kuvvet taramasını durdurmaktır. Bu yüzden limit
// BİLEREK yüksek tutulur: aynı okulun/dershanenin tek bir NAT IP'si arkasında
// onlarca öğrenci aynı anda bir Pop-Quiz'e yanıt gönderebilir — dar bir limit
// gerçek, eşzamanlı sınıf kullanımını kırar.
//
// ⚠️ Bellek-içi, TEK SÜREÇ varsayımıyla çalışır (bkz. InProcessQueue'daki aynı
// not) — yatay ölçeklenmiş (çoklu instance) bir dağıtımda bunun yerine
// paylaşılan bir store (Redis/Upstash) gerekir; arayüz burada sabit tutulup
// gövde değiştirilerek geçiş yapılabilir (bkz. FAZ 6).
const WINDOW_MS = 60_000;
export const MAX_REQUESTS_PER_IP = 300;
// Tek bir oturum kimliği için IP'den daha dar bir üst sınır — paylaşılan bir
// okul IP'si arkasında BİR hesabın anormal davranışını (örn. ele geçirilmiş
// bir oturumdan otomatik döngü) yakalamak içindir; normal panel kullanımı
// (birkaç sekmenin periyodik yenilemesi dahil) rahatça bu sınırın altında kalır.
export const MAX_REQUESTS_PER_USER = 200;
// Uzun süre çalışan tek bir Node sürecinde ziyaret eden IP sayısı sınırsız
// büyüyebilir (çoğu tek seferlik) — Map belirli bir boyutu aşarsa tamamen
// temizlenir. Kaba ama etkili: herkesin sayacı sıfırlanır, hiçbir zaman
// sınırsız büyümez.
const MAX_TRACKED_IPS = 50_000;

type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as { generalRateLimitBuckets?: Map<string, Bucket> };
const buckets = globalForRateLimit.generalRateLimitBuckets ?? new Map<string, Bucket>();
if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.generalRateLimitBuckets = buckets;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function checkGeneralRateLimit(key: string, max: number = MAX_REQUESTS_PER_IP): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_IPS) {
    buckets.clear();
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true };
}

// İstemci IP'sini standart proxy header'larından çıkarır. Next.js'in kendi
// isteği (request.ip) App Router Route Handler'larında güvenilir biçimde
// mevcut değildir — bu yüzden x-forwarded-for (Vercel/çoğu ters proxy'nin
// doldurduğu) tek gerçek kaynaktır; hiçbiri yoksa tüm bilinmeyen istemciler
// aynı "unknown" anahtarını (ve dolayısıyla aynı kaba limiti) paylaşır.
export function extractClientIp(request: Request | undefined): string {
  const forwardedFor = request?.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = request?.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
