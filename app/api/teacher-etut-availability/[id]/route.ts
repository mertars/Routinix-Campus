import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// DELETE /api/teacher-etut-availability/:id — SADECE aralığın sahibi öğretmen
// ya da yönetici silebilir.
async function handleDelete(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const existing = await prisma.teacherEtutAvailability.findUnique({
      where: { id: params.id },
      select: { teacherId: true, teacher: { select: { institutionId: true } } },
    });
    if (!existing || existing.teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Aralık bulunamadı." }, { status: 404 });
    }
    const canManage = (session.role === "TEACHER" && session.sub === existing.teacherId) || session.role === "ADMIN";
    if (!canManage) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

    await prisma.teacherEtutAvailability.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_etut_availability_delete_failed", { id: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const DELETE = withApiLogging("DELETE /api/teacher-etut-availability/[id]", handleDelete);
