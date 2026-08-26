import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findAccountByPhone, normalizePhone } from "@/lib/server/auth/otp";
import { verifyPassword } from "@/lib/server/auth/password";
import { signSessionToken, signPasswordChangeToken, ROLE_ID_BY_AUTH_ROLE, REDIRECT_BY_AUTH_ROLE, SESSION_COOKIE_NAME } from "@/lib/server/auth/jwt";
import { assertRoleMatches } from "@/lib/server/auth/role-guard";
import { assertLoginNotLocked, recordFailedLogin, resetLoginAttempts } from "@/lib/server/auth/rate-limit";
import { AuthError } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

const bodySchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
  expectedRole: z.enum(["principal", "teacher", "student", "parent"]).optional(),
});

async function handlePost(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AuthError("Telefon ve şifre zorunludur.", "MISSING_FIELDS", 400);
    }
    const { phone, password, expectedRole } = parsed.data;
    const normalized = normalizePhone(phone);

    await assertLoginNotLocked(normalized);

    const account = await findAccountByPhone(phone);
    if (!account) {
      // Varlık sızdırmamak için şifre hatasıyla aynı mesaj döner (kilit
      // sayacı da yine de işletilir — telefon numarası taramasını yavaşlatır).
      await recordFailedLogin(normalized);
      throw new AuthError("Telefon veya şifre hatalı.", "INVALID_CREDENTIALS", 401);
    }

    assertRoleMatches(account.role, expectedRole);

    if (!account.passwordHash) {
      throw new AuthError(
        "Bu hesap için henüz şifre belirlenmemiş. Lütfen OTP ile giriş yapın.",
        "PASSWORD_NOT_SET",
        403
      );
    }

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) {
      await recordFailedLogin(normalized);
      throw new AuthError("Telefon veya şifre hatalı.", "INVALID_CREDENTIALS", 401);
    }

    await resetLoginAttempts(normalized);

    if (account.mustChangePassword) {
      // Doğru şifre girildi ama bu geçici bir şifre (örn. admin'in SMS'lediği) —
      // OTP'ye gerek yok, doğru şifreyi bilmek zaten kimlik kanıtıdır. Oturum
      // AÇILMAZ; kullanıcı önce kalıcı bir şifre belirlemeye yönlendirilir.
      const passwordChangeToken = await signPasswordChangeToken({
        sub: account.id,
        role: account.role,
        phone: normalized,
        reason: "FORCED_CHANGE",
        institutionId: account.institutionId,
      });
      return NextResponse.json({ ok: true, mustChangePassword: true, passwordChangeToken });
    }

    const sessionToken = await signSessionToken({
      sub: account.id,
      role: account.role,
      phone: account.phone,
      name: account.name,
      institutionId: account.institutionId,
    });

    const roleId = ROLE_ID_BY_AUTH_ROLE[account.role];
    const response = NextResponse.json({
      ok: true,
      mustChangePassword: false,
      roleId,
      redirect: REDIRECT_BY_AUTH_ROLE[account.role],
      name: account.name,
    });
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    logger.error("login_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/auth/login", handlePost);
