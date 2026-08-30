import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-attempt — { studentId, testId } — Test 1 (Konu
// Bilgisi) oturumu başlatır. Süre/kilit YOK, tamamen açık uçlu (bkz. şema
// yorumu, Faz F) — sorular TEK seferde tam liste olarak döner, soruNo
// sırasıyla (order). correctAnswer/solution/checks BİLEREK gönderilmez —
// "Cevap Anahtarına Ulaş"a kadar saklı kalır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const body = await request.json();
    const { studentId, testId } = body as { studentId?: string; testId?: string };
    if (!studentId || !testId?.trim()) {
      return NextResponse.json({ error: "studentId ve testId zorunludur." }, { status: 400 });
    }
    assertOwnsSelf(session, studentId);

    const questions = await prisma.xrayPracticeQuestion.findMany({
      where: { testId: testId.trim() },
      orderBy: { order: "asc" },
      select: { id: true, order: true, prompt: true },
    });
    if (questions.length === 0) return NextResponse.json({ error: "Bu test için soru bulunamadı." }, { status: 404 });

    const { subject, subtopicId } = await prisma.xrayPracticeQuestion.findFirstOrThrow({
      where: { testId: testId.trim() },
      select: { subject: true, subtopicId: true },
    });

    const attempt = await prisma.xrayPracticeAttempt.create({ data: { studentId, subject, subtopicId, testId: testId.trim() } });

    return NextResponse.json({ attemptId: attempt.id, questions }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_attempt_start_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt", handlePost);
