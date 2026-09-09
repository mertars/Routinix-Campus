import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/auth/password";
import { normalizePhone } from "@/lib/server/auth/otp";
import { signPlatformSessionToken, PLATFORM_SESSION_COOKIE_NAME } from "@/lib/server/auth/platform-jwt";
import { assertLoginNotLocked, recordFailedLogin, resetLoginAttempts } from "@/lib/server/auth/rate-limit";
import { AuthError } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { checkLoginRateLimit, recordFailedLoginAttempt, extractClientIp } from "@/lib/server/rate-limit/general-rate-limit";

// Kurum girişinden (bkz. app/api/auth/login) FARKLI olarak: OTP/ilk-giriş
// akışı yok — PlatformOwner hesapları SADECE scripts/create-platform-owner.ts
// ile, sunucuya doğrudan erişimi olan biri tarafından oluşturulur (self-servis
// kayıt YOK). Bu yüzden burada her zaman doğrudan telefon+şifre ile giriş
// yapılır. assertLoginNotLocked/recordFailedLogin aynı LoginAttempt tablosunu
// (telefon bazlı, kuruma özgü değil) kurum girişleriyle PAYLAŞIR — brute-force
// koruması için sorun değil, iki hesap türü zaten farklı telefon numaraları
// kullanır.
const bodySchema = z.object({ phone: z.string().min(1), password: z.string().min(1) });

async function handlePost(request: NextRequest) {
  try {
    // ⚠️ IP bazlı giriş sınırı, telefon bazlı kilide EK olarak.
    // Telefon kilidi tek hesabı korur; bu, tek şifreyi yüzlerce numarada
    // deneyen püskürtme saldırısını durdurur (bkz. general-rate-limit.ts).
    const clientIp = extractClientIp(request);
    const loginLimit = checkLoginRateLimit(clientIp);
    if (!loginLimit.allowed) {
      return NextResponse.json(
        { error: `Çok fazla giriş denemesi. ${loginLimit.retryAfterSeconds} saniye sonra tekrar deneyin.`, code: "TOO_MANY_ATTEMPTS" },
        { status: 429, headers: { "Retry-After": String(loginLimit.retryAfterSeconds) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AuthError("Telefon ve şifre zorunludur.", "MISSING_FIELDS", 400);
    }
    const { phone, password } = parsed.data;
    const normalized = normalizePhone(phone);

    await assertLoginNotLocked(normalized);

    const owner = await prisma.platformOwner.findUnique({ where: { phone: normalized } });
    if (!owner) {
      recordFailedLoginAttempt(clientIp);
      await recordFailedLogin(normalized);
      throw new AuthError("Telefon veya şifre hatalı.", "INVALID_CREDENTIALS", 401);
    }

    const valid = await verifyPassword(password, owner.passwordHash);
    if (!valid) {
      recordFailedLoginAttempt(clientIp);
      await recordFailedLogin(normalized);
      throw new AuthError("Telefon veya şifre hatalı.", "INVALID_CREDENTIALS", 401);
    }

    await resetLoginAttempts(normalized);

    const token = await signPlatformSessionToken({ sub: owner.id, phone: normalized, name: owner.fullName });
    const response = NextResponse.json({ ok: true, name: owner.fullName });
    response.cookies.set(PLATFORM_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return apiFailure("platform_login_failed", error);
  }
}

export const POST = withApiLogging("POST /api/platform/login", handlePost);
