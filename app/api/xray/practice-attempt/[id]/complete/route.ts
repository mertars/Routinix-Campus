import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-attempt/[id]/complete — oturumu kapatır, kısa
// bir özet döner VE (Faz D) subtopic bazlı bir masteryScore hesaplayıp
// TopicMasteryAssessment'a upsert eder (source=PRACTICE_SELF_REPORT) —
// böylece Test 1'in sonucu da mevcut sonuç ekranında/PDF raporunda
// otomatik görünür, o ekranlarda AYRI bir kod yolu gerekmez.
async function handlePost(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);

    const [answers, questions] = await Promise.all([
      prisma.xrayPracticeAnswer.findMany({ where: { attemptId: attempt.id }, select: { questionId: true, wasCorrect: true } }),
      prisma.xrayPracticeQuestion.findMany({ where: { subject: attempt.subject, subtopicId: attempt.subtopicId }, select: { id: true, checks: true } }),
    ]);
    const checksById = new Map(questions.map((q) => [q.id, q.checks]));
    const missedChecks = answers.filter((a) => !a.wasCorrect).map((a) => checksById.get(a.questionId)).filter((c): c is string => Boolean(c));
    const correctCount = answers.filter((a) => a.wasCorrect).length;

    await prisma.xrayPracticeAttempt.update({ where: { id: attempt.id }, data: { completedAt: new Date() } });

    if (answers.length > 0) {
      const masteryScore = Math.round((correctCount / answers.length) * 100);
      await prisma.topicMasteryAssessment.upsert({
        where: { studentId_subtopicId: { studentId: attempt.studentId, subtopicId: attempt.subtopicId } },
        create: { studentId: attempt.studentId, subject: attempt.subject, subtopicId: attempt.subtopicId, masteryScore, source: "PRACTICE_SELF_REPORT" },
        update: { masteryScore, source: "PRACTICE_SELF_REPORT", sourceSessionId: null, assessedAt: new Date() },
      });
    }

    return NextResponse.json({
      total: questions.length,
      answered: answers.length,
      correct: correctCount,
      missedChecks,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_complete_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt/[id]/complete", handlePost);
