import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-attempt/[id] — Test 1 oturumunu AÇAR. Sorular
// zaten atama anında havuzdan seçilip sabitlenmiş (bkz.
// XrayPracticeAttemptQuestion, POST /api/xray/practice-assignments) —
// bu route sadece o SEÇİMİ döner ve ilk açılışta ASSIGNED -> IN_PROGRESS
// geçişini yapar (bkz. comprehension-assignment/[id]'deki BİREBİR AYNI
// desen). correctAnswer/solution/checks BİLEREK gönderilmez.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Test bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);

    if (attempt.status === "COMPLETED" || attempt.status === "FLAGGED") {
      return NextResponse.json({ error: "Bu test zaten tamamlandı." }, { status: 409 });
    }
    if (attempt.status === "ASSIGNED") {
      await prisma.xrayPracticeAttempt.update({ where: { id: attempt.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    }

    const attemptQuestions = await prisma.xrayPracticeAttemptQuestion.findMany({
      where: { attemptId: attempt.id },
      orderBy: { order: "asc" },
      include: { question: { select: { id: true, prompt: true } } },
    });

    return NextResponse.json({
      attemptId: attempt.id,
      questions: attemptQuestions.map((aq) => ({ id: aq.question.id, order: aq.order, prompt: aq.question.prompt })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_attempt_open_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-attempt/[id]", handleGet);
