import { NextRequest, NextResponse } from "next/server";
import { deleteUserAccountPermanently } from "@/lib/server/admin/update-user";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ⚠️ GERİ ALINAMAZ — bkz. lib/server/admin/update-user.ts >
// deleteUserAccountPermanently içindeki gerekçe. Çoğu durumda doğru
// aksiyon "Pasifleştir" (bkz. .../deactivate) — bu uç sadece kaydın
// kendisinin ve TÜM geçmişinin fiziksel olarak kalkması istendiğinde.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = (await request.json()) as { role?: "STUDENT" | "TEACHER" };
    if (body.role !== "STUDENT" && body.role !== "TEACHER") {
      return NextResponse.json({ error: "role 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
    }

    const result = await deleteUserAccountPermanently({
      id: params.id,
      role: body.role,
      institutionId: session.institutionId,
      actorId: session.sub,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_user_delete_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/users/[id]/delete", handlePost);
