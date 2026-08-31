import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/subtopic-detail/[studentId]?subject=Matematik&subtopicId=X
// — Faz Z6: bir öğrencinin TEK bir alt konudaki geçmiş Test 1 denemeleri
// (ne zaman yapıldı, kaç doğru/yanlış) + HER denemede HANGİ sorular yanlış
// yapıldı (soru metni + doğru cevap + çözüm + checks/diagnosticComment —
// "konu eksiği" bu alandan gelir). Orta sütundaki konu kartlarına tıklama
// özelliği için — sahiplik kuralı GET /api/xray/results/[studentId] ile
// BİREBİR aynı.
//
// Faz Z16 — "genel" testler TEMANIN TÜMÜNÜ kapsadığı için attempt.subtopicId
// artık bir topicId (bkz. lib/server/xray/unit-label.ts), gerçek bir
// subtopicId DEĞİL — bu yüzden attempt.subtopicId'ye göre filtrelemek
// "genel" denemelerini TAMAMEN gözden kaçırırdı. Artık SORU seviyesinde
// (answers.question.subtopicId) filtreleniyor: bir denemenin İÇİNDE bu
// alt konuya ait EN AZ 1 soru varsa o deneme listelenir, ama sadece O ALT
// KONUYA AİT sorular sayılır/gösterilir (30 sorunun tamamı değil).
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();

    const student = await prisma.student.findUnique({ where: { id: params.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, params.studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, params.studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, params.studentId);

    const subject = request.nextUrl.searchParams.get("subject");
    const subtopicId = request.nextUrl.searchParams.get("subtopicId");
    if (!subject?.trim() || !subtopicId?.trim()) return NextResponse.json({ error: "subject ve subtopicId parametreleri zorunludur." }, { status: 400 });

    const attempts = await prisma.xrayPracticeAttempt.findMany({
      where: { studentId: params.studentId, subject, status: "COMPLETED", answers: { some: { question: { subtopicId } } } },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        assignedAt: true,
        completedAt: true,
        answers: { where: { question: { subtopicId } }, select: { wasCorrect: true, question: { select: { prompt: true, correctAnswer: true, solution: true, checks: true, kazanimId: true } } } },
      },
    });

    const result = attempts.map((attempt) => {
      const total = attempt.answers.length;
      const correct = attempt.answers.filter((a) => a.wasCorrect).length;
      const wrongQuestions = attempt.answers
        .filter((a) => !a.wasCorrect)
        .map((a) => ({ questionText: a.question.prompt, correctAnswer: a.question.correctAnswer, solution: a.question.solution, checks: a.question.checks, kazanimId: a.question.kazanimId }));
      return {
        attemptId: attempt.id,
        assignedAt: attempt.assignedAt.toISOString(),
        completedAt: attempt.completedAt?.toISOString() ?? null,
        total,
        correct,
        masteryScore: total > 0 ? Math.round((correct / total) * 100) : null,
        wrongQuestions,
      };
    });

    return NextResponse.json({ subtopicId, attempts: result });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_subtopic_detail_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/subtopic-detail/[studentId]", handleGet);
