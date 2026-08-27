import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/auth/password";
import { normalizePhone } from "@/lib/server/auth/otp";
import { signPlatformSessionToken, PLATFORM_SESSION_COOKIE_NAME } from "@/lib/server/auth/platform-jwt";
import { assertLoginNotLocked, recordFailedLogin, resetLoginAttempts } from "@/lib/server/auth/rate-limit";
import { AuthError } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

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
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AuthError("Telefon ve şifre zorunludur.", "MISSING_FIELDS", 400);
    }
    const { phone, password } = parsed.data;
    const normalized = normalizePhone(phone);

    await assertLoginNotLocked(normalized);

    const owner = await prisma.platformOwner.findUnique({ where: { phone: normalized } });
    if (!owner) {
      await recordFailedLogin(normalized);
      throw new AuthError("Telefon veya şifre hatalı.", "INVALID_CREDENTIALS", 401);
    }

    const valid = await verifyPassword(password, owner.passwordHash);
    if (!valid) {
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
    logger.error("platform_login_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/platform/login", handlePost);
