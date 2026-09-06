import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { computeExamResults } from "@/lib/server/exams/exam-results";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/results — denemenin TAM sonuç tablosu (Rapor adımı)
// + alan (track) bazlı sıralamalar. Hesaplama lib/server/exams/
// exam-results.ts > computeExamResults'ta — karne/sıralama PDF'leri de
// AYNI fonksiyonu çağırır, ekranla PDF hiç sapmasın diye.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const data = await computeExamResults(params.id);
    if (!data) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_results_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/results", handleGet);
