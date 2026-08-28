import { NextRequest, NextResponse } from "next/server";
import { deleteAlumniProfile } from "@/lib/server/admin/alumni";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// DELETE: mezun profilini gurur tablosundan kaldırır — öğrencinin kendi
// kaydını ETKİLEMEZ, sadece mezuniyet-sonrası profili siler.
async function handleDelete(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await deleteAlumniProfile(params.id, session.institutionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_alumni_delete_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const DELETE = withApiLogging("DELETE /api/admin/alumni/[id]", handleDelete);
