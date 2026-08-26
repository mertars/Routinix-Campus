import { NextRequest, NextResponse } from "next/server";
import { sendCredentialsBySms, sendBulkCredentials, type BulkUser } from "@/lib/server/notifications/send-credentials";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();

    // Tekil kullanıcı formatı
    if (body.phone && typeof body.phone === "string") {
      const { phone, name, username, password } = body as { phone?: string; name?: string; username?: string; password?: string };
      if (!phone?.trim() || !name?.trim() || !username?.trim() || !password?.trim()) {
        return NextResponse.json({ error: "phone, name, username ve password zorunludur." }, { status: 400 });
      }

      const result = await sendCredentialsBySms(phone.trim(), name.trim(), username.trim(), password.trim());
      if (!result.success) {
        return NextResponse.json({ error: result.error ?? "SMS gönderilemedi." }, { status: 502 });
      }
      return NextResponse.json({ ok: true });
    }

    // Toplu gönderim formatı
    const { users }: { users?: BulkUser[] } = body;
    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: "'users' dizisi boş olamaz veya eksik." }, { status: 400 });
    }

    // Her kullanıcının zorunlu alanlarını doğrula
    const invalidUsers = users.filter(u => !u.phone || !u.name || !u.username);
    if (invalidUsers.length > 0) {
      return NextResponse.json(
        { error: `${invalidUsers.length} kullanıcının telefondan en az biri eksik.` },
        { status: 400 }
      );
    }

    // Topluyu gönderimi yap
    const result = await sendBulkCredentials(users);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: "Bazı SMS'ler gönderilemedi.",
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        errors: result.errors 
      }, { status: 502 });
    }

    return NextResponse.json({ 
      ok: true, 
      sentCount: result.sentCount, 
      failedCount: result.failedCount 
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("send_credentials_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/send-credentials", handlePost);
