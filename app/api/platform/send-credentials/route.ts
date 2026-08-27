import { NextRequest, NextResponse } from "next/server";
import { sendCredentialsBySms } from "@/lib/server/notifications/send-credentials";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// app/api/admin/send-credentials/route.ts'in platform-sahibi eşdeğeri —
// tekil gönderim. Bu uç kurum-scope'suz çalışır (sadece telefon/isim/
// kullanıcı adı/şifre alır, hiçbir DB yazmaz), bu yüzden institutionId'ye
// hiç ihtiyaç yok — tek fark auth kontrolü.
async function handlePost(request: NextRequest) {
  try {
    await requirePlatformSession();
    const body = await request.json();
    const { phone, name, username, password } = body as { phone?: string; name?: string; username?: string; password?: string };
    if (!phone?.trim() || !name?.trim() || !username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "phone, name, username ve password zorunludur." }, { status: 400 });
    }

    const result = await sendCredentialsBySms(phone.trim(), name.trim(), username.trim(), password.trim());
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "SMS gönderilemedi." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("platform_send_credentials_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/platform/send-credentials", handlePost);
