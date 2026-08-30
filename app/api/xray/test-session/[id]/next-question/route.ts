import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { pickNextQuestion, computeSubtopicMastery, type AnsweredQuestion } from "@/lib/server/xray/adaptive-engine";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/test-session/[id]/next-question — testin bir SONRAKİ
// sorusunu döner (correctAnswer HARİÇ — sızdırılmaz). Tüm alt konularda
// artık verilecek soru kalmadıysa test otomatik TAMAMLANIR: her alt konu
// için ustalık skoru hesaplanır (bkz. computeSubtopicMastery) ve
// TopicMasteryAssessment'a upsert edilir — bkz. o modelin şema yorumu.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const testSession = await prisma.xrayTestSession.findUnique({ where: { id: params.id } });
    if (!testSession) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, testSession.studentId);

    if (testSession.status === "COMPLETED") {
      return NextResponse.json({ error: "Bu test oturumu zaten tamamlandı." }, { status: 409 });
    }

    const subtopics = (CURRICULUM_TREE[testSession.subject] ?? []).flatMap((topic) => topic.subtopics.map((s) => s.id));

    const allAnswers = await prisma.xrayTestAnswer.findMany({
      where: { sessionId: testSession.id },
      orderBy: { answeredAt: "asc" },
      select: { subtopicId: true, questionId: true, isCorrect: true, question: { select: { difficulty: true } } },
    });
    const answersBySubtopic = new Map<string, AnsweredQuestion[]>();
    const askedQuestionIds = new Set<string>();
    for (const answer of allAnswers) {
      askedQuestionIds.add(answer.questionId);
      const list = answersBySubtopic.get(answer.subtopicId) ?? [];
      list.push({ difficulty: answer.question.difficulty, isCorrect: answer.isCorrect });
      answersBySubtopic.set(answer.subtopicId, list);
    }

    for (const subtopicId of subtopics) {
      const answeredSoFar = answersBySubtopic.get(subtopicId) ?? [];
      const pool = await prisma.xrayQuestion.findMany({
        where: { subject: testSession.subject, subtopicId, id: { notIn: [...askedQuestionIds] } },
        select: { id: true, difficulty: true },
      });
      const next = pickNextQuestion(answeredSoFar, pool);
      if (!next) continue;

      const question = await prisma.xrayQuestion.findUniqueOrThrow({
        where: { id: next.id },
        select: { id: true, subtopicId: true, difficulty: true, prompt: true, options: true },
      });
      return NextResponse.json({ completed: false, question });
    }

    // Sorulacak soru kalmadı — testi bitir ve skorla.
    const results: { subtopicId: string; masteryScore: number | null }[] = [];
    for (const subtopicId of subtopics) {
      const answered = answersBySubtopic.get(subtopicId) ?? [];
      const masteryScore = computeSubtopicMastery(answered);
      results.push({ subtopicId, masteryScore });
      if (masteryScore === null) continue;
      await prisma.topicMasteryAssessment.upsert({
        where: { studentId_subtopicId: { studentId: testSession.studentId, subtopicId } },
        create: {
          studentId: testSession.studentId,
          subject: testSession.subject,
          subtopicId,
          masteryScore,
          source: "AI_TEST",
          sourceSessionId: testSession.id,
        },
        update: { masteryScore, source: "AI_TEST", sourceSessionId: testSession.id, assessedAt: new Date() },
      });
      await prisma.topicMasteryHistory.create({
        data: { studentId: testSession.studentId, subject: testSession.subject, subtopicId, masteryScore, source: "AI_TEST" },
      });
    }
    await prisma.xrayTestSession.update({ where: { id: testSession.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    return NextResponse.json({ completed: true, results });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_next_question_failed", { sessionId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/test-session/[id]/next-question", handleGet);
