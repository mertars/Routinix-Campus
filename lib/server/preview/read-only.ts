import { AsyncLocalStorage } from "node:async_hooks";
import { PREVIEW_SESSION_COOKIE_NAME, resolveActivePreview, type PreviewSessionPayload } from "@/lib/server/auth/preview-jwt";
import {
  IMPERSONATION_COOKIE_NAME,
  resolveActiveImpersonation,
  type ImpersonationPayload,
} from "@/lib/server/auth/impersonation-jwt";

// ----------------------------------------------------------------------------
// ÖNİZLEME SALT-OKUNUR KİLİDİ — platform önizlemesinin TEK güvenlik garantisi.
//
// Mert'in şartı (2026-09-15): "hiçbir güvenlik açığı da yaratma". Bir
// önizleme oturumunun gerçek bir müşterinin kaydını değiştirebilmesi tam
// olarak o açık olurdu. Bu yüzden yazma İKİ BAĞIMSIZ katmanda engellenir:
//
//   1. YÖNTEM KATMANI (lib/logger.ts > withApiLogging): mutasyon yöntemleri
//      (POST/PUT/PATCH/DELETE) handler HİÇ ÇALIŞMADAN 403 ile döner.
//      270 API rotasının 269'unu kapsar.
//   2. VERİTABANI KATMANI (lib/server/db-preview-guard.ts): bu dosyadaki
//      AsyncLocalStorage bayrağı açıkken Prisma'nın HER yazma işlemi
//      reddedilir. Birinci katmanın kapsamadığı durumu (GET içinden yazan
//      bir uç, ileride eklenecek sarmalanmamış bir rota) yakalar.
//
// ⚠️ Modül düzeyinde bir değişken KULLANILMAZ (bkz. db-archive.ts'teki
// currentActor — o, script'lerde de çalışması gereken farklı bir ihtiyaç).
// Burada eşzamanlılık kritik: aynı anda gelen gerçek bir istek ile bir
// önizleme isteği birbirinin bayrağını görmemeli. AsyncLocalStorage istek
// başına izole bir kapsam verir, modül değişkeni vermez.
// ----------------------------------------------------------------------------

// ⚠️ ARTIK İKİ TÜR SALT-OKUNUR OTURUM VAR ve ikisi de AYNI kilidi kullanır:
//   * Platform önizlemesi (preview)      — platform sahibi, yazma modu opsiyonel.
//   * Yönetici görüntülemesi (impersonation) — kurum yöneticisi, yazma YOK.
// Aynı depo/aynı kilit bilerek paylaşılıyor: ikinci bir yazma engeli
// mekanizması yazmak, ikisinden birinin ileride unutulması demekti.
export type ReadOnlySession =
  | (PreviewSessionPayload & { kind: "preview" })
  | (ImpersonationPayload & { kind: "impersonation" });

const previewStore = new AsyncLocalStorage<ReadOnlySession>();

/** İstek gövdesini salt-okunur kapsamında çalıştırır — Prisma kilidi burada aktiftir. */
export function runAsPreview<T>(payload: ReadOnlySession, fn: () => T): T {
  return previewStore.run(payload, fn);
}

/** Şu anki istek salt-okunur bir oturumdan geliyorsa yükü, değilse null döner. */
export function currentPreview(): ReadOnlySession | null {
  return previewStore.getStore() ?? null;
}

function readCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Bu istek için AKTİF önizleme oturumunu çözer — salt-okunur kilidinin
 * uygulanıp uygulanmayacağını belirleyen tek soru.
 *
 * ⚠️ Kural session-guard.ts ve middleware.ts ile BİREBİR aynı olmak zorunda:
 * üçü de preview-jwt.ts > resolveActivePreview'ı çağırır, yani "önizleme +
 * geçerli platform sahibi oturumu" şartı tek bir yerde tanımlıdır. Üç yerde
 * ayrı ayrı yazılsaydı biri değişip diğerleri kalabilir, sayfanın gördüğü
 * kimlik ile API'nin gördüğü kimlik ayrışabilirdi.
 */
export async function resolveEffectivePreview(request: Request | undefined): Promise<ReadOnlySession | null> {
  const cookieHeader = request?.headers.get("cookie");
  if (!cookieHeader) return null;

  const read = (name: string) => {
    const raw = readCookie(cookieHeader, name);
    return raw ? decodeURIComponent(raw) : null;
  };

  // Hızlı çıkış: iki cookie'den hiçbiri yoksa JWT doğrulaması yapma
  // (bu kontrol HER API isteğinde çalışıyor). Cookie adları birbirinin alt
  // dizesi değil, bu yüzden includes() güvenli bir ön eleme.
  if (cookieHeader.includes(`${PREVIEW_SESSION_COOKIE_NAME}=`)) {
    const preview = await resolveActivePreview(read);
    if (preview) return { ...preview, kind: "preview" };
  }
  // ⚠️ SIRA ÖNEMLİ: platform önizlemesi kurum yöneticisinin görüntülemesini
  // EZER. Platform sahibi bir kurumun yönetici panelini önizlerken oradan
  // "Panele Gir" denirse iki cookie birden bulunabilir; o durumda geçerli
  // olan, daha yetkili ve zaten salt-okunur olan önizlemedir.
  if (cookieHeader.includes(`${IMPERSONATION_COOKIE_NAME}=`)) {
    const impersonation = await resolveActiveImpersonation(read);
    if (impersonation) return { ...impersonation, kind: "impersonation" };
  }
  return null;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Veritabanına HİÇBİR ŞEY yazmayan, yalnızca sunucu loguna satır düşen uç —
// önizlemede de çalışması İYİ bir şey: önizleme sırasında tarayıcıda çıkan
// bir hata (bkz. app/api/client-errors/route.ts) yine bize ulaşsın.
const READ_ONLY_SAFE_POSTS = new Set(["/api/client-errors"]);

// Önizleme oturumu kimlik/oturum DEĞİŞTİREN uçlara dokunamaz — şifre
// belirleme, OTP gönderme/doğrulama, giriş, çıkış. Bir önizlemenin kendini
// gerçek bir oturuma yükseltebileceği tek teorik yol budur.
//
// ⚠️ Bu kural SADECE mutasyon yöntemlerine uygulanır (aşağıdaki sıraya
// dikkat). Önce "yöntem ne olursa olsun /api/auth/* yasak" yazılmıştı ve
// bu, canlı testte GERÇEK bir hatayı ortaya çıkardı: GET /api/auth/session
// da 403 alıyordu. O uç salt okunurdur ve panellerin "ben kimim" bilgisini
// öğrenmesinin TEK yoludur (httpOnly cookie'yi JS okuyamaz — bkz.
// app/api/auth/session/route.ts) — engellenince öğrenci/öğretmen paneli
// kendi id'sini bulamıyor, yani önizleme "gerçek giriş gibi" görünmüyordu.
// /api/auth altındaki diğer beş uç zaten yalnızca POST kabul ediyor, yani
// genel mutasyon kuralı onları eksiksiz kapsıyor.
const FORBIDDEN_PREFIXES = ["/api/auth/"];

// ÖNİZLEMENİN KENDİ KONTROL DÜZLEMİ — önizleme AÇIKKEN de çalışmak ZORUNDA.
//
// ⚠️ Bu istisna olmasaydı önizleme kendi kendini kilitlerdi: rol değiştirmek
// için atılan POST /api/platform/preview isteği, o sırada zaten var olan
// önizleme cookie'si yüzünden kendi salt-okunur kilidine takılırdı.
// Güvenlik açısından bedava: bu uçların GERÇEK kapısı requirePlatformSession
// (routinix-platform-session cookie'si), önizleme token'ı onu ASLA vermez.
const PREVIEW_CONTROL_PREFIX = "/api/platform/preview";
// Yönetici görüntülemesinin başlat/çık ucu.
const IMPERSONATION_CONTROL_PATH = "/api/admin/impersonate";
const PLATFORM_LOGOUT_PATH = "/api/platform/logout";

// Platform yönetimi (kurum açma, şifre sıfırlama, toplu içe aktarma) bir
// önizleme açıkken YAZMAYA kapalıdır.
//
// Gerekçe — derinlemesine savunma: önizleme, bir MÜŞTERİNİN verisini
// platform konsoluyla AYNI origin'de bir iframe'de render eder. Nonce
// tabanlı CSP (script-src'de 'unsafe-inline' yok) ve React'ın varsayılan
// kaçışı, müşteri verisinden gelen bir script'in çalışmasını zaten
// engelliyor; bu kural o savunmanın ARKASINDAKİ ikinci kapı: o senaryo yine
// de gerçekleşse bile, o koddan platform yetkisiyle bir yazma yapılamaz.
// Okumalar serbest bırakılır — platform panosunun kendi listesi önizleme
// açıkken de tazelenebilsin diye.
const PLATFORM_ADMIN_PREFIX = "/api/platform/";

/**
 * Önizleme oturumu bu isteği yapabilir mi? Yapamıyorsa kullanıcıya
 * gösterilecek Türkçe gerekçeyi döner, yapabiliyorsa null.
 */
export function previewBlockReason(
  method: string,
  pathname: string,
  canWrite = false,
  kind: ReadOnlySession["kind"] = "preview"
): string | null {
  // 1. Salt-okunur oturumların KENDİ kontrol düzlemi — her zaman serbest.
  //
  // ⚠️ Bu istisna olmasaydı özellik kendi kendini kilitlerdi: görüntülemeden
  // ÇIKMAK için atılan POST isteği, o sırada var olan görüntüleme cookie'si
  // yüzünden kendi salt-okunur kilidine takılırdı. Güvenlik açısından
  // bedava: bu uçların gerçek kapısı yönetici/platform oturumudur, bu
  // token'lar onu asla vermez.
  if (pathname === PLATFORM_LOGOUT_PATH || pathname === PREVIEW_CONTROL_PREFIX || pathname.startsWith(`${PREVIEW_CONTROL_PREFIX}/`)) {
    return null;
  }
  if (pathname === IMPERSONATION_CONTROL_PATH) return null;
  // 2. OKUMA her zaman serbest — önizlemenin bütün amacı bu.
  if (!MUTATING_METHODS.has(method.toUpperCase())) return null;
  // 3. Veritabanına dokunmayan, sadece log yazan uçlar.
  if (READ_ONLY_SAFE_POSTS.has(pathname)) return null;
  // 4. Kimlik/oturum değiştirme — en net gerekçeyle reddedilir.
  if (FORBIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "Önizleme oturumu kimlik ve oturum işlemlerini yapamaz.";
  }
  // 5. Platform yönetimi yazmaları — önizleme açıkken kapalı.
  if (pathname.startsWith(PLATFORM_ADMIN_PREFIX)) {
    return "Önizleme açıkken platform yönetimi işlemi yapılamaz. Önce önizlemeyi kapatın.";
  }
  // 6. Geri kalan her yazma — YAZMA MODU açıksa serbest.
  //
  // ⚠️ Yukarıdaki 4. ve 5. maddeler yazma modunda DA geçerli: kimlik/oturum
  // işlemleri ve platform yönetimi yazmaları her koşulda kapalı. Yazma modu
  // yalnızca "kurum panelinde normal bir kullanıcının yapabileceği işler"
  // içindir — bkz. preview-jwt.ts > canWrite üstündeki risk çözümlemesi.
  // ⚠️ YÖNETİCİ GÖRÜNTÜLEMESİNDE YAZMA MODU YOKTUR — canWrite bakılmaz bile.
  // Gerekçe impersonation-jwt.ts'te: bir yöneticinin öğretmen/öğrenci adına
  // kayıt değiştirmesi, denetim izinde o işi öğretmenin/öğrencinin yapmış
  // gibi göstermek demektir; kurum içi hesap verebilirliği bozar.
  if (kind === "impersonation") {
    return "Görüntüleme modundasınız — bu ekranda değişiklik yapılamaz. İşlem yapmak için görüntülemeden çıkın.";
  }
  if (canWrite) return null;
  return "Önizleme salt okunurdur. Üstteki \"Yazma Modu\" düğmesiyle açabilirsiniz.";
}
