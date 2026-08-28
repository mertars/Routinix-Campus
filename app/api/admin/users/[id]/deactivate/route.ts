import { NextRequest, NextResponse } from "next/server";
import { deactivateUserAccount } from "@/lib/server/admin/update-user";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Hard delete YOK (bkz. lib/server/admin/update-user.ts > deactivateUserAccount
// içindeki gerekçe) — bu uç bir öğrenci/öğretmeni PASİFLEŞTİRİR: giriş
// engellenir, genel listelerden düşer, geçmiş kayıtları (not, devamsızlık
// vb.) korunur.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = (await request.json()) as { role?: "STUDENT" | "TEACHER" };
    if (body.role !== "STUDENT" && body.role !== "TEACHER") {
      return NextResponse.json({ error: "role 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
    }

    const result = await deactivateUserAccount({
      id: params.id,
      role: body.role,
      institutionId: session.institutionId,
      actorId: session.sub,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_user_deactivate_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/users/[id]/deactivate", handlePost);
