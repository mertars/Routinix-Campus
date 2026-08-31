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
// yapılmış sayılır. Faz Z16 — "genel" testler TEK bir alt konu değil,
// TEMANIN TÜMÜNÜ kapsadığı için mastery skoru artık HER alt konu için
// AYRI AYRI (o alt konudan gelen sorulardaki doğru/yanlış oranına göre)
// hesaplanıp TopicMasteryAssessment'a upsert edilir (source=
// PRACTICE_SELF_REPORT) — attempt.subtopicId'ye (ki "genel" için artık
// bir topicId'dir, bkz. lib/server/xray/unit-label.ts) TEK bir toplu skor
// yazmak, o id'nin karşılığı gerçek bir alt konu olmadığı için anlamsız/
// hatalı bir kayıt oluştururdu. "alt_konu" testlerinde tüm sorular zaten
// TEK bir subtopicId'ye ait olduğundan bu, ÖNCEKİ davranışla birebir aynı
// sonucu üretir (geriye dönük uyumlu).
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
      include: { question: { select: { id: true, checks: true, subtopicId: true } } },
    });

    await prisma.xrayPracticeAnswer.createMany({
      data: attemptQuestions.map((aq) => ({ attemptId: attempt.id, questionId: aq.questionId, wasCorrect: !notDone.has(aq.questionId) })),
      skipDuplicates: true,
    });
    await prisma.xrayPracticeAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    const missedChecks = attemptQuestions.filter((aq) => notDone.has(aq.questionId)).map((aq) => aq.question.checks);
    const correct = attemptQuestions.length - notDone.size;

    if (attemptQuestions.length > 0) {
      const bySubtopic = new Map<string, { total: number; correct: number }>();
      for (const aq of attemptQuestions) {
        const entry = bySubtopic.get(aq.question.subtopicId) ?? { total: 0, correct: 0 };
        entry.total++;
        if (!notDone.has(aq.questionId)) entry.correct++;
        bySubtopic.set(aq.question.subtopicId, entry);
      }

      for (const [subtopicId, stats] of bySubtopic) {
        const subtopicMasteryScore = Math.round((stats.correct / stats.total) * 100);
        await prisma.topicMasteryAssessment.upsert({
          where: { studentId_subtopicId: { studentId: attempt.studentId, subtopicId } },
          create: { studentId: attempt.studentId, subject: attempt.subject, subtopicId, masteryScore: subtopicMasteryScore, source: "PRACTICE_SELF_REPORT" },
          update: { masteryScore: subtopicMasteryScore, source: "PRACTICE_SELF_REPORT", sourceSessionId: null, assessedAt: new Date() },
        });
        await prisma.topicMasteryHistory.create({
          data: { studentId: attempt.studentId, subject: attempt.subject, subtopicId, masteryScore: subtopicMasteryScore, source: "PRACTICE_SELF_REPORT" },
        });
        const subtopicName = CURRICULUM_TREE[attempt.subject]?.flatMap((t) => t.subtopics).find((s) => s.id === subtopicId)?.name ?? subtopicId;
        await maybeCreateAutoReferral(attempt.studentId, attempt.subject, subtopicName, subtopicMasteryScore);
      }
    }

    return NextResponse.json({ total: attemptQuestions.length, correct, missedChecks });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_complete_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt/[id]/complete", handlePost);
