import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { notifyExamResultReady } from "@/lib/server/exams/exam-notify";

export const dynamic = "force-dynamic";

// POST /api/exams/[id]/notify — { studentIds?: string[] }. studentIds
// verilmezse (tam bu denemede sonucu olan) TÜM öğrencilere bildirim
// gönderir — "bütün öğrenci panellerine gönder" butonu buraya bağlanır.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true, name: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const explicitIds: string[] | undefined = Array.isArray(body?.studentIds) ? body.studentIds.filter((x: unknown) => typeof x === "string") : undefined;

    const studentIds =
      explicitIds ??
      (await prisma.examNetResult.findMany({ where: { examId: params.id }, select: { studentId: true }, distinct: ["studentId"] })).map(
        (r) => r.studentId
      );
    if (studentIds.length === 0) return NextResponse.json({ error: "Bildirilecek öğrenci yok." }, { status: 400 });

    await notifyExamResultReady({
      institutionId: session.institutionId,
      examId: params.id,
      examName: exam.name,
      studentIds,
      authorName: session.role === "ADMIN" ? "Kurum Yönetimi" : "Öğretmen",
      authorRole: session.role === "ADMIN" ? "ADMIN" : "TEACHER",
    });

    return NextResponse.json({ notifiedCount: studentIds.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_notify_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/exams/[id]/notify", handlePost);
