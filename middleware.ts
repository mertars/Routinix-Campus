import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, ROLE_ID_BY_AUTH_ROLE } from "@/lib/server/auth/jwt";
import { verifyPlatformSessionToken, PLATFORM_SESSION_COOKIE_NAME } from "@/lib/server/auth/platform-jwt";

// Panel rotalarını GERÇEK, sunucu tarafı imzalı oturuma (routinix-kampus-session,
// bkz. lib/server/auth/jwt.ts) göre korur. Rol bilgisi tarayıcıdan okunabilir/
// yazılabilir bir cookie'den DEĞİL, doğrulanmış JWT'nin içinden gelir — bu
// yüzden DevTools'tan cookie değiştirerek başka bir role geçmek artık mümkün
// değildir. "routinix-kampus-role" cookie'si (bkz. lib/role-context.tsx) hâlâ
// var ama sadece kozmetik persona görünümü içindir, yetkilendirme burada.
const SESSION_COOKIE = "routinix-kampus-session";

const ROUTE_ROLE: Record<string, string> = {
  "/principal": "principal",
  "/teacher": "teacher",
  "/student": "student",
  "/parent": "parent",
  // Akademik Röntgen (Hub'daki 2. modül) — ERP'den (/principal, /teacher)
  // AYRI, kendi rotaları. Aynı iki role açık ama ERP'nin tab setini
  // GÖRMEMELİ, bu yüzden /principal'ın altına değil kendi prefix'ine konur.
  "/xray/principal": "principal",
  "/xray/teacher": "teacher",
};

// CSP nonce'ı burada, HER sayfa isteğinde yeniden üretilir (statik bir değer
// script-src'yi anlamsızlaştırır — tahmin edilebilir olurdu). next.config.mjs
// bunu BİLEREK yapmaz; sadece middleware istek başına çalışır. Next.js, bu
// header'daki 'nonce-...' değerini KENDİ enjekte ettiği hydration/RSC inline
// script'lerine otomatik uygular; app/layout.tsx'teki elle yazılmış iki
// script ise nonce'ı headers()'tan okuyup kendisi uygular (bkz. orada).
// Video Ders Merkezi — kullanıcı kararı (2026-09-03): videolar Cloudflare
// R2'de. İki farklı R2 ucu var: 1) tarayıcı video dosyasını DOĞRUDAN
// (bizim sunucumuzdan geçmeden) R2'nin S3-uyumlu yükleme adresine PUT eder
// — bu bir connect-src izni gerektirir; 2) oynatıcı (<video>) dosyayı
// R2'nin HERKESE AÇIK adresinden okur — bu bir media-src izni gerektirir.
// İkisi de env değişkenlerinden TÜRETİLİYOR (hardcode YOK) — R2 ayarları
// yapılmadan hiçbir dış R2 domaini CSP'ye eklenmiyor (varsayılan güvenli).
const r2PublicOrigin = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).origin : null;
  } catch {
    return null;
  }
})();
const r2UploadOrigin = process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null;

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' — Video Ders Merkezi'nin tarayıcı-içi dönüştürücüsü
    // (ffmpeg.wasm, bkz. lib/client/transcode.ts) WebAssembly ÇALIŞTIRIYOR.
    // 'unsafe-eval'in aksine SADECE WASM derlemesine izin verir, rastgele JS
    // eval'ine İZİN VERMEZ — güvenlik açısından çok daha dar kapsamlı.
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `media-src 'self'${r2PublicOrigin ? ` ${r2PublicOrigin}` : ""}`,
    "font-src 'self' data:",
    // blob: — ffmpeg.wasm'ın Worker'ı çekirdek dosyaları blob: URL'lerinden
    // fetch ediyor (bkz. lib/client/transcode.ts > toBlobURL kullanımı).
    `connect-src 'self' blob:${r2UploadOrigin ? ` ${r2UploadOrigin}` : ""}`,
    "worker-src 'self' blob:",
    // Özel PDF Oluşturucu'nun canlı önizlemesi (xray-custom-report-builder.tsx)
    // /api/xray/custom-report'tan dönen PDF blob'unu bir <iframe>'de gösteriyor
    // — frame-src AÇIKÇA belirtilmezse default-src'ye ('self') düşer ve
    // 'self' blob: URL'lerini KAPSAMAZ (img-src/worker-src'deki AYNI kural,
    // burada da tekrarlanmalı) — tarayıcı iframe'i sessizce engelliyordu.
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const cspHeader = buildCsp(nonce);

  const { pathname } = request.nextUrl;

  // /platform — kurum panellerinin (ROUTE_ROLE) TAMAMEN dışında, ayrı bir
  // cookie/JWT ile korunan Platform Sahibi (Süper Admin) alanı (bkz.
  // lib/server/auth/platform-jwt.ts). /platform/login'in kendisi hariç tüm
  // /platform/* burada korunur — API tarafında da requirePlatformSession()
  // ayrıca doğrular, bu sadece sayfa seviyesinde erken bir yönlendirmedir.
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    if (pathname === "/platform/login") {
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("Content-Security-Policy", cspHeader);
      return response;
    }
    const platformToken = request.cookies.get(PLATFORM_SESSION_COOKIE_NAME)?.value;
    const platformSession = platformToken ? await verifyPlatformSessionToken(platformToken) : null;
    if (platformSession) {
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("Content-Security-Policy", cspHeader);
      return response;
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/platform/login";
    loginUrl.search = "";
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Content-Security-Policy", cspHeader);
    return response;
  }

  // /hub — Kampüs V2 modül seçim ekranı (Launcher). ROUTE_ROLE'deki diğer
  // rotaların aksine TEK bir role değil, İKİ role (principal + teacher)
  // açık olduğu için genel prefix->role eşlemesine sığmıyor, burada ayrı
  // ele alınır. Öğrenci/Veli oturumuyla gelinirse (henüz tek modülleri
  // olduğu için) kendi paneline değil, rol seçim ekranına döner — panel
  // rotalarındaki "yanlış role" davranışıyla tutarlı.
  if (pathname === "/hub" || pathname.startsWith("/hub/")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    const roleId = session ? ROLE_ID_BY_AUTH_ROLE[session.role] : null;
    if (roleId === "principal" || roleId === "teacher") {
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("Content-Security-Policy", cspHeader);
      return response;
    }
    const url = request.nextUrl.clone();
    if (!session) {
      url.pathname = "/login";
      url.search = "";
    } else {
      url.pathname = "/";
      url.search = "?denied=hub";
    }
    const response = NextResponse.redirect(url);
    response.headers.set("Content-Security-Policy", cspHeader);
    return response;
  }

  const matchedPrefix = Object.keys(ROUTE_ROLE).find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!matchedPrefix) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", cspHeader);
    return response;
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const roleId = session ? ROLE_ID_BY_AUTH_ROLE[session.role] : null;

  if (roleId === ROUTE_ROLE[matchedPrefix]) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", cspHeader);
    return response;
  }

  const url = request.nextUrl.clone();
  if (!session) {
    // Hiç oturum yok — doğrudan girişe yönlendir.
    url.pathname = "/login";
    url.search = "";
  } else {
    // Oturum var ama başka bir role ait — rol seçim ekranına, hangi panele
    // erişilemediğini gösteren bir uyarıyla dön.
    url.pathname = "/";
    url.search = `?denied=${encodeURIComponent(matchedPrefix.slice(1))}`;
  }
  const response = NextResponse.redirect(url);
  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
}

export const config = {
  // API route'ları ve statik varlıklar hariç TÜM sayfa rotaları — CSP
  // nonce'ının her HTML yanıtına uygulanması gerekir; API zaten JSON döner,
  // tarayıcı CSP'si orada anlamsızdır (rate limit/auth koruması ayrı, bkz.
  // lib/logger.ts > withApiLogging ve lib/server/auth/session-guard.ts).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
