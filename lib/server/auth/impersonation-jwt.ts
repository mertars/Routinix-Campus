import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/server/env";
import { verifySessionToken, SESSION_COOKIE_NAME, type AuthRole } from "@/lib/server/auth/jwt";

// ----------------------------------------------------------------------------
// YÖNETİCİ PANEL GÖRÜNTÜLEME ("Panele Gir") — DÖRDÜNCÜ oturum türü.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): "yönetici herkesin paneline girebiliyordu,
// istediği öğrenci/öğretmen için 'panele git'e basıp giriş yapıyor... kendi
// kurumunun admini istediğine ulaşabilsin, güvenlik açığı oluşmasın."
//
// Bu, platform sahibinin önizlemesinin (bkz. preview-jwt.ts) kurum
// yöneticisine uyarlanmış hâlidir. Aynı iskelet bilerek tekrar kullanılır:
// o mekanizma zaten denetlenmiş ve iki katmanlı bir salt-okunur kilidi var.
//
// Sistemdeki oturum türleri — DÖRDÜ de aynı AUTH_SECRET ile imzalanır ama
// FARKLI 'aud' claim'i taşır, bu yüzden jose'nin kendisi yanlış türdeki bir
// token'ı reddeder; hiçbiri diğerinin yerine geçemez:
//   routinix:session                → kurum kullanıcısı        (7 gün)
//   routinix:platform-session       → platform sahibi          (1 gün)
//   routinix:preview-session        → platform önizlemesi      (1 saat, salt okunur)
//   routinix:impersonation-session  → YÖNETİCİ görüntülemesi   (30 dk, salt okunur)
//
// 🔒 BU TOKEN'IN YAPAMADIKLARI (özelliğin güvenliği buradan gelir):
//
//   1. SADECE YÖNETİCİ üretebilir. Uç requireRole(session, "principal")
//      ile korunur; öğretmen/öğrenci/veli kendisi için üretemez.
//   2. SADECE KENDİ KURUMU. Hedef kullanıcı, istemciden gelen id'ye
//      güvenilerek DEĞİL, yöneticinin kurumundan DOĞRULANARAK seçilir.
//      Ayrıca token çözülürken de kurum eşitliği TEKRAR kontrol edilir —
//      başka kurumdan sızmış bir token hiç okunmaz.
//   3. BAŞKA BİR YÖNETİCİYE GİRİLEMEZ. Yönetici→yönetici geçişi yasak:
//      aynı kurumda olsalar bile bu, bir yöneticinin diğerinin adına iş
//      yapmasının kapısı olurdu ve kurum içi hesap verebilirliği bozardı.
//   4. SALT OKUNUR — istisnasız. Önizlemedeki "yazma modu" burada YOK.
//      Gerekçe: platform sahibi sistemin sahibidir; kurum yöneticisi ise
//      kendi çalışanlarının ve öğrencilerinin kaydını onların adına
//      değiştirebilseydi, denetim izinde işi ÖĞRENCİ/ÖĞRETMEN yapmış gibi
//      görünürdü. "Müdür öğretmenin yerine yoklama aldı" gerçek bir
//      sorumluluk açığıdır. Görüntüleme tüm destek ihtiyacını karşılar.
//   5. TEK BAŞINA DEĞERSİZ. Aynı tarayıcıda GEÇERLİ bir YÖNETİCİ oturumu
//      yoksa hiç okunmaz — çalınan bir cookie işe yaramaz, yönetici çıkış
//      yaptığı an etkisiz kalır (bkz. resolveActiveImpersonation).
//   6. KİMLİK İŞLEMLERİ KAPALI. /api/auth/* mutasyonları (şifre belirleme,
//      OTP, giriş) bu oturumdan yapılamaz — kendini gerçek bir oturuma
//      yükseltmenin tek teorik yolu budur ve kapalıdır.
//   7. 30 dakika ömür; çıkışta ve yönetici oturumu bittiğinde silinir.
// ----------------------------------------------------------------------------

export const IMPERSONATION_COOKIE_NAME = "routinix-impersonation-session";

const IMPERSONATION_AUDIENCE = "routinix:impersonation-session";

export type ImpersonationPayload = {
  // Kurum oturumuyla AYNI alanlar — panel kodu "tıpkı o kullanıcı girmiş
  // gibi" çalışsın diye (bkz. preview-jwt.ts'teki aynı gerekçe).
  sub: string;
  role: AuthRole;
  phone: string;
  name: string;
  institutionId: string;
  /** Kurum oturumunda OLMAYAN imza — bu bir görüntüleme oturumudur. */
  impersonation: true;
  /** Denetim izi: hangi yönetici başlattı. */
  by: string;
  /** Bant ve loglarda gösterilecek yönetici adı. */
  byName: string;
};

// 30 dakika: bir panele bakıp sorunu görmeye fazlasıyla yeter, sızan bir
// cookie'nin değerini düşürecek kadar kısa.
const IMPERSONATION_TTL_SECONDS = 30 * 60;
export const IMPERSONATION_MAX_AGE_SECONDS = IMPERSONATION_TTL_SECONDS;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function signImpersonationToken(payload: ImpersonationPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(IMPERSONATION_AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + IMPERSONATION_TTL_SECONDS)
    .sign(secretKey());
}

export async function verifyImpersonationToken(token: string): Promise<ImpersonationPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: IMPERSONATION_AUDIENCE });
    // impersonation:true imzanın İÇİNDE — audience kontrolüne EK bir kemer.
    if ((payload as { impersonation?: unknown }).impersonation !== true) return null;
    return payload as unknown as ImpersonationPayload;
  } catch {
    return null;
  }
}

/**
 * Bu istek için AKTİF görüntüleme oturumu — DÖRT kapının dördü de açıksa.
 *
 * ⚠️ Kural tek yerde tanımlıdır ve session-guard, middleware ile
 * read-only kilidi ÜÇÜ de buraya sorar (preview-jwt.ts'teki aynı gerekçe:
 * üç yerde ayrı yazılsaydı sayfanın gördüğü kimlik ile API'nin gördüğü
 * kimlik ayrışabilirdi).
 *
 *   1. Geçerli bir görüntüleme token'ı var,
 *   2. AYNI tarayıcıda GEÇERLİ bir kurum oturumu var,
 *   3. O oturum ADMIN rolünde ve görüntülemeyi başlatan yöneticiyle AYNI kişi,
 *   4. Yöneticinin kurumu ile hedefin kurumu AYNI.
 *
 * 4. şart kritik: token'ın içindeki institutionId'ye TEK BAŞINA güvenilmez.
 * Böylece bir kurumdan sızan token başka bir kurumun tarayıcısında hiçbir
 * şey ifade etmez.
 */
export async function resolveActiveImpersonation(
  readCookie: (name: string) => string | undefined | null
): Promise<ImpersonationPayload | null> {
  const token = readCookie(IMPERSONATION_COOKIE_NAME);
  if (!token) return null;
  const adminToken = readCookie(SESSION_COOKIE_NAME);
  if (!adminToken) return null;

  const [impersonation, admin] = await Promise.all([
    verifyImpersonationToken(token),
    verifySessionToken(adminToken),
  ]);
  if (!impersonation || !admin) return null;
  if (admin.role !== "ADMIN") return null;
  if (impersonation.by !== admin.sub) return null;
  if (impersonation.institutionId !== admin.institutionId) return null;
  return impersonation;
}
