import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-attempt/[id]/answer-key — "Cevap Anahtarını Gör"
// akışı: bu ATTEMPT için (havuzdan rastgele SEÇİLİP sabitlenmiş, bkz.
// XrayPracticeAttemptQuestion) soruların çözümlerini açar.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);

    const attemptQuestions = await prisma.xrayPracticeAttemptQuestion.findMany({
      where: { attemptId: attempt.id },
      orderBy: { order: "asc" },
      include: { question: { select: { id: true, prompt: true, correctAnswer: true, solution: true } } },
    });

    const questions = attemptQuestions.map((aq) => ({
      id: aq.question.id,
      order: aq.order,
      prompt: aq.question.prompt,
      correctAnswer: aq.question.correctAnswer,
      solution: aq.question.solution,
    }));

    return NextResponse.json({ questions });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_answer_key_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-attempt/[id]/answer-key", handleGet);
