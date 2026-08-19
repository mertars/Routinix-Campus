import { NextRequest, NextResponse } from "next/server";
import { sendCredentialsBySms } from "@/lib/server/notifications/send-credentials";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/admin/send-credentials — sadece oluşturma anında istemcinin
// hafızasındaki şifreyi SMS ile iletir; şifre hiçbir yerde düz metin
// saklanmadığı için bu uç nokta DB'den şifre OKUMAZ, doğrudan geçirilir.
async function handlePost(request: NextRequest) {
  try {
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
    logger.error("send_credentials_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/send-credentials", handlePost);
