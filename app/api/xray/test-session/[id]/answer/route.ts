import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/test-session/[id]/answer — { questionId, selectedAnswer } —
// doğru cevap SUNUCUDA kontrol edilir (istemciye hiç gönderilmez, bkz.
// next-question route'undaki select — correctAnswer alanı YOK).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const testSession = await prisma.xrayTestSession.findUnique({ where: { id: params.id } });
    if (!testSession) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, testSession.studentId);
    if (testSession.status === "COMPLETED") {
      return NextResponse.json({ error: "Bu test oturumu zaten tamamlandı." }, { status: 409 });
    }

    const body = await request.json();
    const { questionId, selectedAnswer } = body as { questionId?: string; selectedAnswer?: string };
    if (!questionId || !selectedAnswer?.trim()) {
      return NextResponse.json({ error: "questionId ve selectedAnswer zorunludur." }, { status: 400 });
    }

    const question = await prisma.xrayQuestion.findUnique({ where: { id: questionId }, select: { subtopicId: true, correctAnswer: true } });
    if (!question) return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });

    const existing = await prisma.xrayTestAnswer.findFirst({ where: { sessionId: testSession.id, questionId } });
    if (existing) return NextResponse.json({ error: "Bu soru zaten cevaplandı." }, { status: 409 });

    const isCorrect = selectedAnswer.trim() === question.correctAnswer;
    await prisma.xrayTestAnswer.create({
      data: { sessionId: testSession.id, questionId, subtopicId: question.subtopicId, selectedAnswer: selectedAnswer.trim(), isCorrect },
    });

    return NextResponse.json({ isCorrect });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_answer_failed", { sessionId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/test-session/[id]/answer", handlePost);
