import { NextResponse } from "next/server";
import { PLATFORM_SESSION_COOKIE_NAME } from "@/lib/server/auth/platform-jwt";
import { PREVIEW_SESSION_COOKIE_NAME } from "@/lib/server/auth/preview-jwt";
import { withApiLogging } from "@/lib/logger";

async function handlePost() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PLATFORM_SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  // Açık kalmış bir panel önizlemesi platform çıkışını ATLATMAMALI: önizleme
  // token'ı platform oturumundan BAĞIMSIZ imzalıdır (ayrı 'aud'), yani
  // yalnızca platform cookie'sini silmek onu geçersiz kılmaz — kendi
  // ömrünün sonuna kadar (1 saat) panelleri açmaya devam ederdi.
  response.cookies.set(PREVIEW_SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}

export const POST = withApiLogging("POST /api/platform/logout", handlePost);
