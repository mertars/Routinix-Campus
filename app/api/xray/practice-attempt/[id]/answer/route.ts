import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-attempt/[id]/answer — { questionId, selectedAnswer } —
// SADECE MULTIPLE_CHOICE sorular için anlık, sunucu tarafı derecelendirme
// (bkz. kullanıcı kararı: "şıklı olanlar otomatik"). OPEN_ENDED sorular bu
// route'tan GEÇMEZ — onlar .../answer-key + .../self-report akışına gider.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);

    const body = await request.json();
    const { questionId, selectedAnswer } = body as { questionId?: string; selectedAnswer?: string };
    if (!questionId || !selectedAnswer?.trim()) {
      return NextResponse.json({ error: "questionId ve selectedAnswer zorunludur." }, { status: 400 });
    }

    const question = await prisma.xrayPracticeQuestion.findUnique({ where: { id: questionId } });
    if (!question) return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });
    if (question.format !== "MULTIPLE_CHOICE") {
      return NextResponse.json({ error: "Bu soru açık uçlu — cevap anahtarı akışını kullanın." }, { status: 400 });
    }

    const isCorrect = selectedAnswer.trim() === question.correctAnswer;
    await prisma.xrayPracticeAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
      create: { attemptId: attempt.id, questionId, wasCorrect: isCorrect, selfReported: false },
      update: { wasCorrect: isCorrect, selfReported: false },
    });

    return NextResponse.json({ isCorrect, correctAnswer: question.correctAnswer, solution: question.solution });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_answer_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt/[id]/answer", handlePost);
