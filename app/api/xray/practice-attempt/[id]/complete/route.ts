import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-attempt/[id]/complete — { notDoneQuestionIds } —
// "Yapamadıklarım" listesini gönderir: işaretlenmemiş her soru DOĞRU
// yapılmış sayılır (bkz. Faz F — tamamen açık uçlu bir testte tek pratik
// öz-değerlendirme modeli budur). Bir masteryScore hesaplanıp
// TopicMasteryAssessment'a upsert edilir (source=PRACTICE_SELF_REPORT) —
// böylece sonuç mevcut sonuç ekranında/PDF raporunda otomatik görünür.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);
    if (attempt.completedAt) return NextResponse.json({ error: "Bu test zaten tamamlandı." }, { status: 409 });

    const body = await request.json().catch(() => ({}));
    const { notDoneQuestionIds } = body as { notDoneQuestionIds?: string[] };
    const notDone = new Set(Array.isArray(notDoneQuestionIds) ? notDoneQuestionIds : []);

    const questions = await prisma.xrayPracticeQuestion.findMany({
      where: { testId: attempt.testId },
      select: { id: true, checks: true, kazanimId: true },
    });

    await prisma.xrayPracticeAnswer.createMany({
      data: questions.map((q) => ({ attemptId: attempt.id, questionId: q.id, wasCorrect: !notDone.has(q.id) })),
      skipDuplicates: true,
    });
    await prisma.xrayPracticeAttempt.update({ where: { id: attempt.id }, data: { completedAt: new Date() } });

    const missedChecks = questions.filter((q) => notDone.has(q.id)).map((q) => q.checks);
    const correct = questions.length - notDone.size;

    if (questions.length > 0) {
      const masteryScore = Math.round((correct / questions.length) * 100);
      await prisma.topicMasteryAssessment.upsert({
        where: { studentId_subtopicId: { studentId: attempt.studentId, subtopicId: attempt.subtopicId } },
        create: { studentId: attempt.studentId, subject: attempt.subject, subtopicId: attempt.subtopicId, masteryScore, source: "PRACTICE_SELF_REPORT" },
        update: { masteryScore, source: "PRACTICE_SELF_REPORT", sourceSessionId: null, assessedAt: new Date() },
      });
    }

    return NextResponse.json({ total: questions.length, correct, missedChecks });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_complete_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt/[id]/complete", handlePost);
