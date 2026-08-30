import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { maybeCreateAutoReferral } from "@/lib/server/xray/auto-referral";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-attempt/[id]/complete — { notDoneQuestionIds } —
// "Yapamadıklarım" listesini gönderir: işaretlenmemiş her soru DOĞRU
// yapılmış sayılır. Bir masteryScore hesaplanıp TopicMasteryAssessment'a
// upsert edilir (source=PRACTICE_SELF_REPORT) — böylece sonuç mevcut
// sonuç ekranında/PDF raporunda otomatik görünür.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);
    if (attempt.status !== "IN_PROGRESS") return NextResponse.json({ error: "Bu test aktif değil." }, { status: 409 });

    const body = await request.json().catch(() => ({}));
    const { notDoneQuestionIds } = body as { notDoneQuestionIds?: string[] };
    const notDone = new Set(Array.isArray(notDoneQuestionIds) ? notDoneQuestionIds : []);

    const attemptQuestions = await prisma.xrayPracticeAttemptQuestion.findMany({
      where: { attemptId: attempt.id },
      include: { question: { select: { id: true, checks: true } } },
    });

    await prisma.xrayPracticeAnswer.createMany({
      data: attemptQuestions.map((aq) => ({ attemptId: attempt.id, questionId: aq.questionId, wasCorrect: !notDone.has(aq.questionId) })),
      skipDuplicates: true,
    });
    await prisma.xrayPracticeAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    const missedChecks = attemptQuestions.filter((aq) => notDone.has(aq.questionId)).map((aq) => aq.question.checks);
    const correct = attemptQuestions.length - notDone.size;

    if (attemptQuestions.length > 0) {
      const masteryScore = Math.round((correct / attemptQuestions.length) * 100);
      await prisma.topicMasteryAssessment.upsert({
        where: { studentId_subtopicId: { studentId: attempt.studentId, subtopicId: attempt.subtopicId } },
        create: { studentId: attempt.studentId, subject: attempt.subject, subtopicId: attempt.subtopicId, masteryScore, source: "PRACTICE_SELF_REPORT" },
        update: { masteryScore, source: "PRACTICE_SELF_REPORT", sourceSessionId: null, assessedAt: new Date() },
      });
      await prisma.topicMasteryHistory.create({
        data: { studentId: attempt.studentId, subject: attempt.subject, subtopicId: attempt.subtopicId, masteryScore, source: "PRACTICE_SELF_REPORT" },
      });
      const subtopicName = CURRICULUM_TREE[attempt.subject]?.flatMap((t) => t.subtopics).find((s) => s.id === attempt.subtopicId)?.name ?? attempt.subtopicId;
      await maybeCreateAutoReferral(attempt.studentId, attempt.subject, subtopicName, masteryScore);
    }

    return NextResponse.json({ total: attemptQuestions.length, correct, missedChecks });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_complete_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt/[id]/complete", handlePost);
