import { NextResponse, type NextRequest } from "next/server";

// ⚠️ DEMO-SEVİYESİ ROL KAPISI — GERÇEK GÜVENLİK DEĞİL.
// Bu uygulamada henüz gerçek bir kimlik doğrulama/oturum sistemi yok (bkz.
// Student/Teacher/Admin.passwordHash alanları — dolu ama hiçbir yerde
// doğrulanmıyor). "routinix-kampus-role" cookie'si sadece lib/role-context.tsx
// üzerinden kullanıcının kendi seçtiği persona'yı taşır; tarayıcı DevTools'tan
// elle değiştirilebilir. Bu middleware SADECE kazara/dolaylı çapraz-rol
// gezinmesini engeller (örn. bir öğrencinin /principal linkini bulup tıklaması).
// Gerçek yetkilendirme için: şifre doğrulamalı login + sunucu tarafı
// imzalı oturum (örn. iron-session/next-auth) + API route'larının da bu
// oturuma göre korunması gerekir — şu an API route'ları bu kapıdan geçmiyor.
const ROUTE_ROLE: Record<string, string> = {
  "/principal": "principal",
  "/teacher": "teacher",
  "/student": "student",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const matchedPrefix = Object.keys(ROUTE_ROLE).find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!matchedPrefix) return NextResponse.next();

  const role = request.cookies.get("routinix-kampus-role")?.value;
  if (role !== ROUTE_ROLE[matchedPrefix]) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = `?denied=${encodeURIComponent(matchedPrefix.slice(1))}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/principal/:path*", "/teacher/:path*", "/student/:path*"],
};
