import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// DELETE /api/exam-groups/[id] — eşleştirmeyi kaldırır. İçindeki
// DENEMELER SİLİNMEZ (Exam.groupId SetNull, bkz. şema): kendi
// klasörlerinde (TYT / AYT) tekil deneme olarak durmaya devam ederler.
async function handleDelete(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const group = await prisma.examGroup.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!group || group.institutionId !== session.institutionId) return NextResponse.json({ error: "Eşleştirme bulunamadı." }, { status: 404 });

    await prisma.examGroup.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_group_delete_failed", { groupId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const DELETE = withApiLogging("DELETE /api/exam-groups/[id]", handleDelete);
