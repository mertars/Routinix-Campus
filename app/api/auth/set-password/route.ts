import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyPasswordChangeToken,
  signSessionToken,
  ROLE_ID_BY_AUTH_ROLE,
  REDIRECT_BY_AUTH_ROLE,
  SESSION_COOKIE_NAME,
} from "@/lib/server/auth/jwt";
import { hashPassword, setAccountPassword } from "@/lib/server/auth/password";
import { assertRoleMatches } from "@/lib/server/auth/role-guard";
import { resetLoginAttempts } from "@/lib/server/auth/rate-limit";
import { AuthError } from "@/lib/server/auth/errors";
import { prisma } from "@/lib/server/prisma";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { withApiLogging, logger } from "@/lib/logger";

const TARGET_TYPE_BY_ROLE: Record<string, string> = {
  STUDENT: "Student",
  TEACHER: "Teacher",
  ADMIN: "Admin",
  PARENT: "Parent",
};

const bodySchema = z.object({
  passwordChangeToken: z.string().min(1),
  password: z.string().min(6),
  expectedRole: z.enum(["principal", "teacher", "student", "parent"]).optional(),
});

// Şifre değiştirme token'ı üç ayrı olaydan gelebilir (bkz. jwt.ts >
// PasswordChangeReason) ama hepsi burada aynı şekilde işlenir: token geçerliyse
// yeni şifre yazılır, mustChangePassword kapatılır ve oturum açılır.
async function handlePost(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AuthError(
        parsed.error.issues[0]?.path[0] === "password" ? "Şifre en az 6 karakter olmalıdır." : "Geçersiz istek.",
        "INVALID_BODY",
        400
      );
    }
    const { passwordChangeToken, password, expectedRole } = parsed.data;

    const payload = await verifyPasswordChangeToken(passwordChangeToken);
    if (!payload) {
      throw new AuthError(
        "Doğrulama süresi doldu veya geçersiz. Lütfen telefon adımından tekrar başlayın.",
        "TOKEN_EXPIRED",
        401
      );
    }

    assertRoleMatches(payload.role, expectedRole);

    const passwordHash = await hashPassword(password);
    await setAccountPassword(payload.sub, payload.role, passwordHash);
    await resetLoginAttempts(payload.phone);

    await recordAuditLog({
      institutionId: payload.institutionId,
      actorId: payload.sub,
      actorRole: payload.role,
      action: "PASSWORD_CHANGED",
      targetType: TARGET_TYPE_BY_ROLE[payload.role] ?? payload.role,
      targetId: payload.sub,
      metadata: { reason: payload.reason },
    });

    const accountName = await resolveAccountName(payload.sub, payload.role);
    const sessionToken = await signSessionToken({
      sub: payload.sub,
      role: payload.role,
      phone: payload.phone,
      name: accountName,
      institutionId: payload.institutionId,
    });

    const roleId = ROLE_ID_BY_AUTH_ROLE[payload.role];
    const response = NextResponse.json({ ok: true, roleId, redirect: REDIRECT_BY_AUTH_ROLE[payload.role] });
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
    logger.error("set_password_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function resolveAccountName(id: string, role: string): Promise<string> {
  if (role === "TEACHER") {
    const t = await prisma.teacher.findUnique({ where: { id } });
    return t ? `${t.firstName} ${t.lastName}`.trim() : "";
  }
  if (role === "STUDENT") {
    const s = await prisma.student.findUnique({ where: { id } });
    return s ? `${s.firstName} ${s.lastName}`.trim() : "";
  }
  if (role === "ADMIN") {
    const a = await prisma.admin.findUnique({ where: { id } });
    return a ? `${a.firstName} ${a.lastName}`.trim() : "";
  }
  if (role === "PARENT") {
    const p = await prisma.parent.findUnique({ where: { id } });
    return p ? `${p.firstName} ${p.lastName}`.trim() : "";
  }
  return "";
}

export const POST = withApiLogging("POST /api/auth/set-password", handlePost);
