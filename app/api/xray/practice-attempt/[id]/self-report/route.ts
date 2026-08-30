import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-attempt/[id]/self-report — { questionId, wasCorrect } —
// cevap anahtarını gördükten sonra öğrencinin KENDİ beyanı (esas olarak
// OPEN_ENDED sorular için — MCQ'da sistem zaten otomatik biliyor, bkz.
// .../answer route'u, ama öğrenci isterse üzerine yazabilir).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);

    const body = await request.json();
    const { questionId, wasCorrect } = body as { questionId?: string; wasCorrect?: boolean };
    if (!questionId || typeof wasCorrect !== "boolean") {
      return NextResponse.json({ error: "questionId ve wasCorrect (boolean) zorunludur." }, { status: 400 });
    }

    const question = await prisma.xrayPracticeQuestion.findUnique({ where: { id: questionId }, select: { id: true } });
    if (!question) return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });

    await prisma.xrayPracticeAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
      create: { attemptId: attempt.id, questionId, wasCorrect, selfReported: true },
      update: { wasCorrect, selfReported: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_self_report_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt/[id]/self-report", handlePost);
