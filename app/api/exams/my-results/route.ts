import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { computeExamSubtopicBreakdown, type SubtopicBreakdownRow } from "@/lib/server/exams/subtopic-breakdown";

export const dynamic = "force-dynamic";

type SubjectResult = { subject: string; net: number; breakdown: SubtopicBreakdownRow[] | null };
type ExamResult = { examId: string; examName: string; examDate: Date; subjects: SubjectResult[] };

// GET /api/exams/my-results — "Deneme Sonuçlarım" (öğrenci tarafı, kendi
// verisi). Kullanıcı talebi: edesis'in "deneme modülü"nde öğrenci kendi
// doğru/yanlış/boş oranını ve kazanım bazlı grafiğini görebiliyor — bizde
// bu güne kadar sadece yönetici/öğretmen tarafında (Ölçme Değerlendirme)
// vardı, öğrenciye HİÇ yansımıyordu. Kazanım kırılımı (cevap anahtarı +
// yanlış/boş soru girilmişse) her sınav+ders için ayrı ayrı hesaplanır —
// bkz. computeExamSubtopicBreakdown (aynı fonksiyon Ölçme Değerlendirme
// panelinin de kullandığı).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const rows = await prisma.examNetResult.findMany({
      where: { studentId: session.sub },
      select: {
        subject: true,
        net: true,
        wrongQuestionNumbers: true,
        blankQuestionNumbers: true,
        exam: { select: { id: true, name: true, examDate: true } },
      },
      orderBy: { exam: { examDate: "desc" } },
    });

    const examMap = new Map<string, ExamResult>();
    for (const r of rows) {
      const entry = examMap.get(r.exam.id) ?? { examId: r.exam.id, examName: r.exam.name, examDate: r.exam.examDate, subjects: [] };
      const hasKazanimData = r.wrongQuestionNumbers.length > 0 || r.blankQuestionNumbers.length > 0;
      entry.subjects.push({ subject: r.subject, net: r.net, breakdown: hasKazanimData ? [] : null });
      examMap.set(r.exam.id, entry);
    }

    const exams = [...examMap.values()];
    // Sadece kazanım verisi olan (öğrenci wrong/blank girilmiş) satırlar
    // için kırılımı hesapla — gereksiz sorgu yapmamak için önce filtrele.
    for (const exam of exams) {
      for (const s of exam.subjects) {
        if (s.breakdown !== null) {
          s.breakdown = await computeExamSubtopicBreakdown(exam.examId, session.sub, s.subject);
        }
      }
    }

    return NextResponse.json({ exams });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_my_results_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/my-results", handleGet);
