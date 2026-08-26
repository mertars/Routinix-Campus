import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/server/env";

// ----------------------------------------------------------------------------
// Oturum / kısa ömürlü token yardımcıları.
//
// * SessionToken         : kalıcı giriş oturumu (7 gün, httpOnly cookie)
// * PasswordChangeToken  : "bu telefonun sahibi olduğu / mevcut şifreyi
//   bildiği kanıtlandı, yeni bir şifre belirleyebilir" kısa ömürlü izni
//   taşır. Üç farklı olaydan sonra verilir (reason alanı hangisi olduğunu
//   taşır) ama hepsi AYNI /api/auth/set-password ucunu kullanır:
//     - FIRST_LOGIN   : OTP doğrulandı, hesabın hiç şifresi yoktu
//     - PASSWORD_RESET: "Şifremi Unuttum" ile OTP doğrulandı
//     - FORCED_CHANGE : mustChangePassword=true iken MEVCUT şifreyle
//                       giriş doğrulandı (örn. admin'in SMS'lediği geçici
//                       şifre) — burada OTP YOKTUR, kanıt zaten doğru
//                       şifreyi bilmekten gelir.
//
// HS256 simetrik imza kullanılıyor; gizli anahtar AUTH_SECRET ortam
// değişkeninden gelir. Üretimde mutlaka güçlü bir AUTH_SECRET tanımlanmalı.
// ----------------------------------------------------------------------------

// httpOnly oturum cookie'sinin adı — tek gerçek kaynak burası; login/logout/
// set-password route'ları ve session-guard.ts hepsi buradan alır (aksi halde
// bir yerde yazım hatası sessizce oturumu kırar).
export const SESSION_COOKIE_NAME = "routinix-kampus-session";

export type AuthRole = "STUDENT" | "TEACHER" | "ADMIN" | "PARENT";

// Oturum token'ında taşınan kullanıcının seçili persona'sına (lib/role-context)
// ve /principal, /teacher, /student rotalarına karşılık gelen kısa role id.
// Admin -> principal; Parent -> parent (middleware /parent'ı korumaz).
export type RoleId = "principal" | "teacher" | "student" | "parent";

export const ROLE_ID_BY_AUTH_ROLE: Record<AuthRole, RoleId> = {
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN: "principal",
  PARENT: "parent",
};

export const REDIRECT_BY_AUTH_ROLE: Record<AuthRole, string> = {
  STUDENT: "/student",
  TEACHER: "/teacher",
  ADMIN: "/principal",
  PARENT: "/parent",
};

export type SessionPayload = {
  sub: string;
  role: AuthRole;
  phone: string;
  name: string;
  institutionId: string;
};

export type PasswordChangeReason = "FIRST_LOGIN" | "PASSWORD_RESET" | "FORCED_CHANGE";

export type PasswordChangePayload = {
  sub: string;
  role: AuthRole;
  phone: string;
  reason: PasswordChangeReason;
  institutionId: string;
};

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 gün
// Demo/test ortamında şifre değiştirme token süresi 1 saat — production'da 15 dakika
const PASSWORD_CHANGE_TTL_SECONDS = process.env.NODE_ENV === "production" ? 15 * 60 : 60 * 60;

// AUTH_SECRET burada DEĞİL, getEnv()'den okunur — üretimde eksik/zayıf bir
// değerle boot anında (instrumentation.ts) fail-fast tetiklenmiş olur; bu
// fonksiyon o noktaya hiç ulaşmaz. Bkz. lib/server/env.ts.
function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  // ⚠️ jose'de setExpirationTime()'a düz bir sayı verilirse bu MUTLAK bir
  // epoch (saniye) olarak yorumlanır, "şu andan X saniye sonra" değil —
  // SESSION_TTL_SECONDS (604800) verilince exp 1970-01-08'e denk geliyor,
  // yani her token imzalandığı an zaten süresi dolmuş oluyordu. Bu yüzden
  // exp mutlak epoch olarak burada elle hesaplanır.
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function signPasswordChangeToken(payload: PasswordChangePayload): Promise<string> {
  // Aynı mutlak-epoch düzeltmesi burada da geçerli (bkz. signSessionToken).
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + PASSWORD_CHANGE_TTL_SECONDS)
    .sign(secretKey());
}

export async function verifyPasswordChangeToken(token: string): Promise<PasswordChangePayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as PasswordChangePayload;
  } catch {
    return null;
  }
}