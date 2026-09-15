import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/server/env";
import type { AuthRole } from "@/lib/server/auth/jwt";
import { PLATFORM_SESSION_COOKIE_NAME, verifyPlatformSessionToken } from "@/lib/server/auth/platform-jwt";

// ----------------------------------------------------------------------------
// ÖNİZLEME OTURUMU — platform sahibinin bir kurumun panelini "içeriden"
// görebilmesi için üretilen ÜÇÜNCÜ oturum türü.
//
// Neden ayrı bir dosya/cookie/audience: lib/server/auth/platform-jwt.ts'teki
// AYNI gerekçe. Sistemde artık üç oturum türü var ve HİÇBİRİ diğerinin yerine
// geçemez — üçü de aynı AUTH_SECRET ile imzalanıyor ama farklı 'aud' claim'i
// taşıyor, bu yüzden jose'nin KENDİSİ yanlış türdeki bir token'ı reddeder:
//   routinix:session           → kurum kullanıcısı (7 gün)
//   routinix:platform-session  → platform sahibi   (1 gün)
//   routinix:preview-session   → ÖNİZLEME          (1 saat, SALT OKUNUR)
//
// ⚠️ GÜVENLİK SINIRLARI — bu token'ın ne YAPAMADIĞI, ne yapabildiğinden
// daha önemli:
//   1. SADECE platform sahibi üretebilir (POST /api/platform/preview →
//      requirePlatformSession). Kurum kullanıcısının kendisi için üretmesinin
//      hiçbir yolu yok.
//   2. SALT OKUNUR. Mutasyon yöntemleri (POST/PUT/PATCH/DELETE) tek noktadan
//      (withApiLogging) reddedilir, AYRICA Prisma seviyesinde her yazma
//      işlemi bloke edilir (bkz. lib/server/db-preview-guard.ts) — GET
//      içinden yazmaya çalışan bir uç bile veri değiştiremez.
//   3. TEK BAŞINA DEĞERSİZDİR: aynı tarayıcıda GEÇERLİ bir platform sahibi
//      oturumu (routinix-platform-session) yoksa hiç okunmaz. Yani sızan bir
//      önizleme cookie'si hiçbir işe yaramaz ve platform çıkışı yapıldığı an
//      etkisiz kalır. Bkz. resolveActivePreview.
//   4. Kısa ömürlü (1 saat) — platform çıkışında da temizlenir.
// ----------------------------------------------------------------------------

export const PREVIEW_SESSION_COOKIE_NAME = "routinix-preview-session";

const PREVIEW_SESSION_AUDIENCE = "routinix:preview-session";

export type PreviewSessionPayload = {
  // Kurum oturumuyla AYNI alanlar — requireSession() bunu doğrudan bir
  // Session gibi döndürebilsin diye (panel kodunun önizlemede olduğunu
  // bilmesine gerek yok, "tıpkı uygulamadan girmiş biri gibi" görünsün).
  sub: string;
  role: AuthRole;
  phone: string;
  name: string;
  institutionId: string;
  // Kurum oturumunda OLMAYAN iki alan — önizlemeyi ayırt eden imza.
  preview: true;
  // Denetim izi: bu önizlemeyi hangi platform sahibi başlattı.
  previewBy: string;
  // YAZMA MODU — varsayılan yok/false (salt okunur).
  //
  // ⚠️ Mert (2026-09-15) "önizlemede deneme yapamıyorum, güncelleme
  // yapabilsem güvenlik açığı çıkar mı" diye sordu. Cevap: AÇIK DEĞİL.
  // Önizleme token'ı tek başına zaten değersiz — aynı tarayıcıda geçerli
  // bir platform sahibi oturumu olmadan hiç okunmuyor (bkz.
  // resolveActivePreview). Yani yazma yetkisi "platform sahibinin zaten
  // yapabildiği" sınırı genişletmiyor. Gerçek riskler başka yerde ve
  // önlemleri şunlar:
  //   1. Gerçek müşteri verisine YANLIŞLIKLA yazmak → mod açıkça açılır
  //      (varsayılan kapalı) ve arayüzde kırmızı bantla durur.
  //   2. Denetimde yanlış kişi görünmesi (kimliğine bürünülen kullanıcı
  //      yapmış gibi durur) → yazma modundaki HER mutasyon
  //      api_preview_write olarak loglanır.
  //   3. Kimlik ele geçirme → /api/auth/* mutasyonları yazma modunda DA
  //      yasak; şifre/OTP/oturum işlemleri önizlemeden asla yapılamaz.
  canWrite?: boolean;
};

// 1 saat: rahat inceleme için yeterince uzun, sızan bir cookie'nin değerini
// düşürecek kadar kısa. Rol değiştirildiğinde zaten yeniden üretiliyor.
const PREVIEW_SESSION_TTL_SECONDS = 60 * 60;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function signPreviewSessionToken(payload: PreviewSessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(PREVIEW_SESSION_AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + PREVIEW_SESSION_TTL_SECONDS)
    .sign(secretKey());
}

export async function verifyPreviewSessionToken(token: string): Promise<PreviewSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: PREVIEW_SESSION_AUDIENCE });
    // preview:true alanı imzanın İÇİNDE — audience kontrolüne EK bir kemer.
    if ((payload as { preview?: unknown }).preview !== true) return null;
    return payload as unknown as PreviewSessionPayload;
  } catch {
    return null;
  }
}

export const PREVIEW_SESSION_MAX_AGE_SECONDS = PREVIEW_SESSION_TTL_SECONDS;

/**
 * Bu istek için AKTİF önizleme oturumu — üç kapının üçü de açıksa.
 *
 * ⚠️ ÖNCELİK KURALI (2026-09-15'te DEĞİŞTİ, gerçek bir hatadan sonra):
 * Önce "gerçek kurum oturumu her zaman kazanır" kuralı vardı. Mert üretimde
 * bunun özelliği İŞE YARAMAZ hale getirdiğini bildirdi: tarayıcısında zaten
 * bir yönetici oturumu açıktı, bu yüzden Öğretmen önizlemesi "bu rolle
 * erişemezsiniz" diye reddediliyor, Yönetici önizlemesi ise açılıyor ama
 * SESSİZCE kendi kurumunu gösteriyordu (yerelde birebir üretildi). Özelliğin
 * var oluş sebebi tam olarak "aynı tarayıcıda başka bir hesaba bakabilmek"
 * olduğu için o kural özelliğin kendisiyle çelişiyordu.
 *
 * Yeni kural önizlemeyi gerçek oturumun ÖNÜNE alır ama üç şartla — ve bu
 * hâli eskisinden DAHA sıkıdır, çünkü önizleme cookie'si artık tek başına
 * hiçbir şey ifade etmez:
 *   1. Geçerli bir önizleme token'ı var,
 *   2. AYNI tarayıcıda GEÇERLİ bir platform sahibi oturumu var,
 *   3. Önizlemeyi başlatan platform sahibi ile şu anki platform sahibi AYNI.
 *
 * Yani önizlemenin bir isteğin kimliğini değiştirebilmesi için o tarayıcının
 * sistemdeki EN YETKİLİ oturumunu zaten taşıyor olması gerekir. Sıradan bir
 * kurum kullanıcısının isteği bundan ETKİLENEMEZ — platform cookie'si yoktur.
 * Önizleme yine de SALT OKUNURDUR (bkz. lib/server/preview/read-only.ts).
 */
export async function resolveActivePreview(
  readCookie: (name: string) => string | undefined | null
): Promise<PreviewSessionPayload | null> {
  const previewToken = readCookie(PREVIEW_SESSION_COOKIE_NAME);
  if (!previewToken) return null;
  const platformToken = readCookie(PLATFORM_SESSION_COOKIE_NAME);
  if (!platformToken) return null;

  const [preview, platform] = await Promise.all([
    verifyPreviewSessionToken(previewToken),
    verifyPlatformSessionToken(platformToken),
  ]);
  if (!preview || !platform) return null;
  if (preview.previewBy !== platform.sub) return null;
  return preview;
}
