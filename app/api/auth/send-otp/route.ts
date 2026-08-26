import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { findAccountByPhone, generateOtpCode, hashOtpCode, normalizePhone } from "@/lib/server/auth/otp";
import { assertRoleMatches } from "@/lib/server/auth/role-guard";
import { assertOtpResendAllowed } from "@/lib/server/auth/rate-limit";
import { AuthError } from "@/lib/server/auth/errors";
import { createSmsProvider } from "@/lib/server/sms/provider-factory";
import { withApiLogging, logger } from "@/lib/logger";

// Bu, giriş akışının İLK adımıdır: telefon + hedef rol gönderilir.
//   * Hesap bulunamazsa                         -> 404 ACCOUNT_NOT_FOUND
//   * Hesap bulunur ama başka role aitse         -> 403 ROLE_MISMATCH
//     (OTP KESİNLİKLE gönderilmez, sonraki adıma KESİNLİKLE geçilmez)
//   * intent="login" (varsayılan):
//       - Hesabın HİÇ şifresi yoksa (passwordHash null, ilk giriş)  -> OTP
//       - Hesabın şifresi VARSA (geçici de olsa)                    -> needsOtp:false,
//         doğrudan şifre adımına geçilir (bkz. /api/auth/login — mustChangePassword
//         orada, doğru şifre GİRİLDİKTEN sonra yeni şifre zorunluluğuna çevrilir)
//   * intent="reset" ("Şifremi Unuttum"): hesabın şifresi olması ZORUNLUDUR,
//     her koşulda OTP gönderilir (PASSWORD_RESET amacıyla)
const OTP_TTL_MS = 30 * 60 * 1000; // 30 dakika

const bodySchema = z.object({
  phone: z.string().min(1),
  expectedRole: z.enum(["principal", "teacher", "student", "parent"]).optional(),
  intent: z.enum(["login", "reset"]).optional().default("login"),
});

async function handlePost(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AuthError("Geçersiz istek.", "INVALID_BODY", 400);
    }
    const { phone, expectedRole, intent } = parsed.data;

    const account = await findAccountByPhone(phone);
    if (!account) {
      throw new AuthError("Bu telefonla kayıtlı bir hesap bulunamadı.", "ACCOUNT_NOT_FOUND", 404);
    }

    assertRoleMatches(account.role, expectedRole);

    if (intent === "login" && account.passwordHash) {
      // Kalıcı ya da geçici — bir şifresi zaten var, OTP'ye gerek yok.
      return NextResponse.json({ ok: true, needsOtp: false, phone: normalizePhone(account.phone) });
    }
    if (intent === "reset" && !account.passwordHash) {
      throw new AuthError(
        "Bu hesap için henüz bir şifre belirlenmemiş. Lütfen normal giriş akışını kullanın.",
        "NO_PASSWORD_TO_RESET",
        400
      );
    }

    const purpose = intent === "reset" ? "PASSWORD_RESET" : "FIRST_LOGIN";
    const normalized = normalizePhone(account.phone);

    await assertOtpResendAllowed(normalized, purpose);

    const code = generateOtpCode();
    const codeHash = await hashOtpCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Aynı telefon+amaç için bekleyen eski kodları temizleyip yenisini yaz —
    // eski bir kodun geçerliliğini koruyup kafa karıştırmasını önler.
    await prisma.$transaction([
      prisma.otpCode.deleteMany({ where: { phone: normalized, purpose, consumedAt: null } }),
      prisma.otpCode.create({ data: { phone: normalized, purpose, codeHash, expiresAt } }),
    ]);

    const message = `Routinix Kampus dogrulama kodunuz: ${code}. Bu kodu kimseyle paylaşmayın. 30 dakika gecerlidir.`;
    const smsResult = await createSmsProvider()
      .send(normalized, message)
      .catch((error) => ({ success: false, error: error instanceof Error ? error.message : String(error) }));

    if (!smsResult.success) {
      logger.error("otp_sms_failed", { phone: normalized, purpose, error: smsResult.error });
      // Production'da kullanıcının kodu alacağı TEK yol SMS'tir — gönderilemediyse
      // akışı burada durdurmak (ekranda sahte bir "gönderildi" göstermemek) doğrudur.
      // Dev/demo'da devOtp zaten ekranda gösterileceği için sağlayıcı hatası
      // (mock sağlayıcı %5 ihtimalle simüle eder) akışı bloklamaz.
      if (process.env.NODE_ENV === "production") {
        throw new AuthError("Kod SMS ile gönderilemedi. Lütfen birkaç saniye sonra tekrar deneyin.", "SMS_FAILED", 502);
      }
    }

    const devOtp = process.env.NODE_ENV !== "production" ? code : null;
    logger.info("otp_sent", { phone: normalized, purpose, dev: devOtp !== null, smsOk: smsResult.success });

    return NextResponse.json({ ok: true, needsOtp: true, devOtp, phone: normalized });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    logger.error("send_otp_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/auth/send-otp", handlePost);
