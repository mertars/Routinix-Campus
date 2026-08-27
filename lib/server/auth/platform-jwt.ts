import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/server/env";

// ----------------------------------------------------------------------------
// Platform Sahibi (Süper Admin) oturumu — BİLEREK lib/server/auth/jwt.ts'teki
// kurum-oturumu (SessionPayload/SESSION_COOKIE_NAME) ile hiçbir kod yolu
// PAYLAŞMAZ: ayrı cookie adı, ayrı payload şekli (institutionId YOK), ayrı
// imzalama/doğrulama fonksiyonları. Amaç: bu iki oturum türünün YANLIŞLIKLA
// karışıp bir kurum oturumunun platform uçlarına (veya tam tersi) erişmesini
// koddan İMKANSIZ hale getirmek — aynı AUTH_SECRET'i (HS256) paylaşmaları
// sorun değil, çünkü payload şekilleri ve cookie'leri tamamen ayrı.
// ----------------------------------------------------------------------------

export const PLATFORM_SESSION_COOKIE_NAME = "routinix-platform-session";

// 'aud' claim'i — bkz. lib/server/auth/jwt.ts'teki aynı isimli GÜVENLİK
// notu: AYNI AUTH_SECRET ile imzalanan bir kurum oturum token'ının burada
// (ya da tam tersi) ham haliyle kabul edilmesini jose seviyesinde engeller.
const PLATFORM_SESSION_AUDIENCE = "routinix:platform-session";

export type PlatformSessionPayload = {
  sub: string;
  phone: string;
  name: string;
};

const PLATFORM_SESSION_TTL_SECONDS = 24 * 60 * 60; // 1 gün — kurum oturumlarından (7 gün) BİLEREK kısa, yüksek yetkili bir hesap

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function signPlatformSessionToken(payload: PlatformSessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(PLATFORM_SESSION_AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + PLATFORM_SESSION_TTL_SECONDS)
    .sign(secretKey());
}

export async function verifyPlatformSessionToken(token: string): Promise<PlatformSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: PLATFORM_SESSION_AUDIENCE });
    return payload as unknown as PlatformSessionPayload;
  } catch {
    return null;
  }
}
