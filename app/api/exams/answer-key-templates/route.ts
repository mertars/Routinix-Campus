import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/exams/answer-key-templates?subject= — bu kurumda, bu ders için
// DAHA ÖNCE cevap anahtarı tanımlanmış sınavları (en yeniden eskiye)
// listeler. Gerekçe: aynı yayın/tür denemenin soru→kazanım dağılımı
// genelde sınavdan sınava SABİT kalır (aynı "TYT Matematik" formatı gibi)
// — yönetici/öğretmen her seferinde 40 soruyu elle eşlemek yerine
// "önceki sınavdan kopyala" diyebilsin diye (bkz. exam-answer-key-modal.tsx).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const subject = request.nextUrl.searchParams.get("subject")?.trim();
    if (!subject) return NextResponse.json({ error: "subject zorunludur." }, { status: 400 });

    const rows = await prisma.examQuestion.findMany({
      where: { subject, exam: { institutionId: session.institutionId } },
      select: { examId: true, exam: { select: { name: true, examDate: true } } },
      distinct: ["examId"],
      orderBy: { exam: { examDate: "desc" } },
      take: 10,
    });

    return NextResponse.json({
      templates: rows.map((r) => ({ examId: r.examId, examName: r.exam.name, examDate: r.exam.examDate })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_answer_key_templates_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/answer-key-templates", handleGet);
