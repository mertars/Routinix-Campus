import { cookies } from "next/headers";
import { verifyPlatformSessionToken, PLATFORM_SESSION_COOKIE_NAME, type PlatformSessionPayload } from "./platform-jwt";
import { AuthError } from "./errors";

// app/api/platform/* uçlarının TEK gerçek giriş noktası — bkz.
// lib/server/auth/session-guard.ts'teki kurum eşdeğeri. Kasıtlı olarak çok
// daha basit: institution.isActive gibi bir "askıya alma" kavramı yok,
// sadece "bu gerçekten platform sahibi mi" doğrulanır.
export async function requirePlatformSession(): Promise<PlatformSessionPayload> {
  const token = cookies().get(PLATFORM_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    throw new AuthError("Oturum bulunamadı. Lütfen giriş yapın.", "NO_SESSION", 401);
  }
  const payload = await verifyPlatformSessionToken(token);
  if (!payload) {
    throw new AuthError("Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.", "INVALID_SESSION", 401);
  }
  return payload;
}
