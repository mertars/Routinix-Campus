import { NextRequest, NextResponse } from "next/server";
import { resetUserPassword } from "@/lib/server/admin/update-user";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Bir öğrenci/öğretmenin GEÇİCİ şifresi bcrypt hash'i olarak saklandığı
// için (tek yönlü) tekrar görüntülenemez — kayıt ekranı kapatılıp not
// alınmadıysa bu, yeni bir tane üretip mustChangePassword'ü tekrar
// zorunlu kılmanın TEK yolu. Yeni kimlik bilgileri, tekli oluşturmayla
// AYNI "Giriş Kartı" modalında bir kereliğine gösterilir.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = (await request.json()) as { role?: "STUDENT" | "TEACHER" };
    if (body.role !== "STUDENT" && body.role !== "TEACHER") {
      return NextResponse.json({ error: "role 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
    }

    const credentials = await resetUserPassword({
      id: params.id,
      role: body.role,
      institutionId: session.institutionId,
      actorId: session.sub,
    });
    return NextResponse.json({ credentials });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_user_password_reset_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/users/[id]/reset-password", handlePost);
