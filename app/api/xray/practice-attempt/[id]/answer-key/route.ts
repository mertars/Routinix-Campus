import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-attempt/[id]/answer-key — "Cevap Anahtarına Ulaş"
// akışı: tüm soruların çözümlerini açar. Tamamen açık uçlu bir testte
// (bkz. Faz F) önceden bilinen bir MCQ cevabı YOK — tüm sorular aynı
// şekilde döner, öğrenci hangisini yapamadığını .../complete'e gönderirken
// kendi işaretler.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);

    const questions = await prisma.xrayPracticeQuestion.findMany({
      where: { testId: attempt.testId },
      orderBy: { order: "asc" },
      select: { id: true, order: true, prompt: true, correctAnswer: true, solution: true },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_answer_key_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-attempt/[id]/answer-key", handleGet);
