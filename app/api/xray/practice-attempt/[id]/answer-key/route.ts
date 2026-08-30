import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-attempt/[id]/answer-key — "Cevap Anahtarına Ulaş"
// akışı: tüm soruların çözümlerini açar. Zaten MCQ ile otomatik cevaplanmış
// sorular için alreadyAnswered=true döner (öğrenci bunları tekrar kendi
// işaretlemesin diye) — sadece OPEN_ENDED (ve cevaplanmamış) sorular
// .../self-report ile işaretlenmeli.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);

    const [questions, answers] = await Promise.all([
      prisma.xrayPracticeQuestion.findMany({
        where: { subject: attempt.subject, subtopicId: attempt.subtopicId },
        orderBy: { difficulty: "asc" },
        select: { id: true, format: true, prompt: true, correctAnswer: true, solution: true },
      }),
      prisma.xrayPracticeAnswer.findMany({ where: { attemptId: attempt.id }, select: { questionId: true, wasCorrect: true } }),
    ]);
    const answeredMap = new Map(answers.map((a) => [a.questionId, a.wasCorrect]));

    const items = questions.map((q) => ({
      ...q,
      alreadyAnswered: answeredMap.has(q.id),
      wasCorrect: answeredMap.get(q.id) ?? null,
    }));

    return NextResponse.json({ questions: items });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_answer_key_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-attempt/[id]/answer-key", handleGet);
