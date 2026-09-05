import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { computeExamClassSubtopicSummary } from "@/lib/server/exams/subtopic-breakdown";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/subtopic-summary?subject= — bu sınav+dersin kazanım
// verisi girilmiş öğrencilerinin sınıf/kurum geneli ortalamasını, en zayıf
// kazanımdan başlayarak döner (bkz. Ölçme Değerlendirme paneli).
async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const subject = request.nextUrl.searchParams.get("subject")?.trim();
    if (!subject) return NextResponse.json({ error: "subject zorunludur." }, { status: 400 });

    const summary = await computeExamClassSubtopicSummary(params.id, subject);
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_subtopic_summary_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/subtopic-summary", handleGet);
