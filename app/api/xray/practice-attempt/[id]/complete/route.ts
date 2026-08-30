import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-attempt/[id]/complete — oturumu kapatır, kısa
// bir özet döner. Tam analiz (TopicMasteryAssessment'a bağlama) Faz D'nin
// işi — burada sadece "kaç doğru, hangi becerilerde (checks) eksik"
// düzeyinde ham bir geri bildirim var.
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

    await prisma.xrayPracticeAttempt.update({ where: { id: attempt.id }, data: { completedAt: new Date() } });

    return NextResponse.json({
      total: questions.length,
      answered: answers.length,
      correct: answers.filter((a) => a.wasCorrect).length,
      missedChecks,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_complete_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt/[id]/complete", handlePost);
