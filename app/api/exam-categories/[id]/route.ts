import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// PATCH /api/exam-categories/[id] — { name }. Yeniden adlandırma.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const existing = await prisma.examCategory.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!existing || existing.institutionId !== session.institutionId) return NextResponse.json({ error: "Klasör bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Klasör adı zorunludur." }, { status: 400 });

    const category = await prisma.examCategory.update({ where: { id: params.id }, data: { name } });
    return NextResponse.json({ category });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Bu isimde bir klasör zaten var." }, { status: 409 });
    }
    logger.error("exam_category_update_failed", { categoryId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// DELETE /api/exam-categories/[id] — klasörü kaldırır. İçindeki denemeler
// SİLİNMEZ (Exam.categoryId SetNull, bkz. şema): "Kategorisiz" klasörüne
// düşerler. Yanıt kaç denemenin etkilendiğini söyler ki arayüz bunu
// kullanıcıya dürüstçe bildirebilsin.
async function handleDelete(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const existing = await prisma.examCategory.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!existing || existing.institutionId !== session.institutionId) return NextResponse.json({ error: "Klasör bulunamadı." }, { status: 404 });

    const affected = await prisma.exam.count({ where: { categoryId: params.id } });
    await prisma.examCategory.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true, movedToUncategorized: affected });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_category_delete_failed", { categoryId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/exam-categories/[id]", handlePatch);
export const DELETE = withApiLogging("DELETE /api/exam-categories/[id]", handleDelete);
