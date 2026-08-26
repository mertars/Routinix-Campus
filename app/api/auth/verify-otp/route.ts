import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { findAccountByPhone, normalizePhone, verifyOtpCode } from "@/lib/server/auth/otp";
import { signPasswordChangeToken } from "@/lib/server/auth/jwt";
import { assertRoleMatches } from "@/lib/server/auth/role-guard";
import { AuthError } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

const MAX_ATTEMPTS = 5;

const bodySchema = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
  expectedRole: z.enum(["principal", "teacher", "student", "parent"]).optional(),
  intent: z.enum(["login", "reset"]).optional().default("login"),
});

async function handlePost(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AuthError("Kod 6 haneli olmalıdır.", "INVALID_CODE", 400);
    }
    const { phone, code, expectedRole, intent } = parsed.data;
    const purpose = intent === "reset" ? "PASSWORD_RESET" : "FIRST_LOGIN";

    const account = await findAccountByPhone(phone);
    if (!account) {
      throw new AuthError("Bu telefonla kayıtlı bir hesap bulunamadı.", "ACCOUNT_NOT_FOUND", 404);
    }

    // Rol kontrolü OTP'nin kendisine bakmadan ÖNCE yapılır — yanlış rol
    // altında hiçbir koşulda kod doğrulanmaz.
    assertRoleMatches(account.role, expectedRole);

    const normalized = normalizePhone(account.phone);
    const record = await prisma.otpCode.findFirst({
      where: { phone: normalized, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      throw new AuthError("Kod bulunamadı veya süresi doldu. Lütfen tekrar kod isteyin.", "NO_ACTIVE_OTP", 400);
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      throw new AuthError("Çok fazla hatalı deneme. Yeni kod isteyin.", "TOO_MANY_ATTEMPTS", 429);
    }

    const valid = await verifyOtpCode(code, record.codeHash);
    if (!valid) {
      await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new AuthError("Kod hatalı.", "INVALID_CODE", 400);
    }

    await prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

    const passwordChangeToken = await signPasswordChangeToken({
      sub: account.id,
      role: account.role,
      phone: normalized,
      reason: intent === "reset" ? "PASSWORD_RESET" : "FIRST_LOGIN",
      institutionId: account.institutionId,
    });

    return NextResponse.json({ ok: true, passwordChangeToken });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    logger.error("verify_otp_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/auth/verify-otp", handlePost);
