import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/logger";
import { SESSION_COOKIE_NAME } from "@/lib/server/auth/jwt";

// Sunucu tarafı oturumu (httpOnly cookie) sonlandırır. httpOnly olduğu için
// istemci JS'i onu doğrudan silemez — çıkış her zaman bu uçtan geçmelidir.
async function handlePost() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export const POST = withApiLogging("POST /api/auth/logout", handlePost);
