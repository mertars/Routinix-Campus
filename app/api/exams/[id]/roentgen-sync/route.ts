import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { syncExamResultToRoentgen } from "@/lib/server/exams/subtopic-breakdown";

export const dynamic = "force-dynamic";

// POST /api/exams/[id]/roentgen-sync — { subject }. Bir dersin kazanım
// eşlemesi SONRADAN yapıldığında Akademik Röntgen'e yeniden yazar.
//
// Neden gerekli: syncExamResultToRoentgen normalde sonuçlar KAYDEDİLİRKEN
// tetiklenir (bkz. lib/server/admin/exam-net-results.ts). Ama tipik akış
// "önce optik yükle, sonra kazanım ata" — o durumda sonuçlar yazıldığı an
// henüz soru→kazanım eşlemesi yoktu, dolayısıyla köprü hiçbir şey
// yazamadı. Bu uç, kazanım ataması bittikten sonra o dersin TÜM
// öğrencileri için köprüyü elle yeniden çalıştırır.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    if (!subject) return NextResponse.json({ error: "subject zorunludur." }, { status: 400 });

    if (!(subject in CURRICULUM_TREE)) {
      // Röntgen'in bu derste konu ağacı yok — kazanım analizi yine
      // hesaplanır (bkz. subtopic-breakdown), sadece Röntgen'e yazılmaz.
      return NextResponse.json({ syncedCount: 0, supportsRoentgenBridge: false });
    }

    const results = await prisma.examNetResult.findMany({
      where: { examId: params.id, subject },
      select: { studentId: true, wrongQuestionNumbers: true, blankQuestionNumbers: true },
    });

    let syncedCount = 0;
    // Sıralı (Promise.all DEĞİL) — nadir/düşük frekanslı bir yönetici
    // işlemi, bağlantı havuzuna gereksiz eşzamanlı baskı yapmaya değmez
    // (aynı gerekçe: bkz. bulkUpsertExamNetResults).
    for (const r of results) {
      if (r.wrongQuestionNumbers.length === 0 && r.blankQuestionNumbers.length === 0) continue;
      await syncExamResultToRoentgen(params.id, r.studentId, subject).catch(() => {});
      syncedCount++;
    }

    return NextResponse.json({ syncedCount, supportsRoentgenBridge: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_roentgen_sync_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/exams/[id]/roentgen-sync", handlePost);
