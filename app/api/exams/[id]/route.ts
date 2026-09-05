import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// PATCH /api/exams/[id] — { name?, examDate?, category? }. Şu an asıl
// kullanımı denemeyi başka bir klasöre taşımak (kategori değiştirme);
// mevcut denemelerin hiçbirinde kategori yoktu, hepsi "Kategorisiz"
// klasöründe başlıyor ve yönetici oradan dağıtıyor.
// category: "" ya da null gönderilirse kategorisiz'e taşınır.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const data: { name?: string; examDate?: Date; category?: string | null } = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Deneme adı boş olamaz." }, { status: 400 });
      data.name = name;
    }
    if (typeof body?.examDate === "string") {
      const parsed = new Date(body.examDate);
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
      data.examDate = parsed;
    }
    if ("category" in (body ?? {})) {
      data.category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });

    const updated = await prisma.exam.update({ where: { id: params.id }, data });
    return NextResponse.json({ exam: updated });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_update_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/exams/[id]", handlePatch);
