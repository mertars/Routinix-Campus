import { prisma } from "@/lib/server/prisma";
import { AuthError } from "./errors";
import type { OtpPurpose } from "@prisma/client";

// ----------------------------------------------------------------------------
// Kapalı bir sistemde giriş ekranı, kötüye kullanıma karşı en az sunucu API'leri
// kadar korunmalı. Burada iki bağımsız koruma var:
//   1) OTP "yeniden gönder" bekleme süresi — aynı telefona art arda SMS
//      atılmasını (maliyet + spam) engeller.
//   2) Şifreli giriş kilidi — art arda yanlış şifre denemesini (brute-force)
//      engeller; OTP'nin aksine şifreli girişte "yeni kod iste" gibi doğal
//      bir sıfırlama noktası olmadığı için ayrı bir sayaç gerekir.
// ----------------------------------------------------------------------------

const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export async function assertOtpResendAllowed(phone: string, purpose: OtpPurpose): Promise<void> {
  const last = await prisma.otpCode.findFirst({
    where: { phone, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return;
  const elapsedMs = Date.now() - last.createdAt.getTime();
  if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
    throw new AuthError(`Lütfen yeni kod istemeden önce ${waitSeconds} saniye bekleyin.`, "OTP_COOLDOWN", 429);
  }
}

export async function assertLoginNotLocked(phone: string): Promise<void> {
  const record = await prisma.loginAttempt.findUnique({ where: { phone } });
  if (record?.lockedUntil && record.lockedUntil.getTime() > Date.now()) {
    const waitMinutes = Math.ceil((record.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AuthError(
      `Çok fazla hatalı deneme. Lütfen ${waitMinutes} dakika sonra tekrar deneyin.`,
      "LOGIN_LOCKED",
      429
    );
  }
}

export async function recordFailedLogin(phone: string): Promise<void> {
  const existing = await prisma.loginAttempt.findUnique({ where: { phone } });
  const failedCount = (existing?.failedCount ?? 0) + 1;
  const lockedUntil = failedCount >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOGIN_LOCKOUT_MS) : null;
  await prisma.loginAttempt.upsert({
    where: { phone },
    update: { failedCount, lockedUntil },
    create: { phone, failedCount, lockedUntil },
  });
}

export async function resetLoginAttempts(phone: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { phone } });
}
