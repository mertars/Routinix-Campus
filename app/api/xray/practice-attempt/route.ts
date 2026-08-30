import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-attempt — { studentId, subject, subtopicId } —
// Test 1 (Konu Bilgisi) oturumu başlatır. Süre/kilit YOK — öğrenci
// istediği zaman bırakıp devam edebilir, bu yüzden sorular TEK seferde
// tam liste olarak döner (bkz. GET altındaki questions), Test 2'nin
// soru-soru akışının aksine. correctAnswer/solution/checks BİLEREK
// gönderilmez — MCQ sorularda anlık derecelendirme anlamını yitirmesin
// diye (bkz. .../answer route'u).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const body = await request.json();
    const { studentId, subject, subtopicId } = body as { studentId?: string; subject?: string; subtopicId?: string };
    if (!studentId || !subject?.trim() || !subtopicId?.trim()) {
      return NextResponse.json({ error: "studentId, subject ve subtopicId zorunludur." }, { status: 400 });
    }
    assertOwnsSelf(session, studentId);

    const [attempt, questions] = await Promise.all([
      prisma.xrayPracticeAttempt.create({ data: { studentId, subject: subject.trim(), subtopicId: subtopicId.trim() } }),
      prisma.xrayPracticeQuestion.findMany({
        where: { subject: subject.trim(), subtopicId: subtopicId.trim() },
        orderBy: { difficulty: "asc" },
        select: { id: true, format: true, difficulty: true, prompt: true, options: true },
      }),
    ]);

    return NextResponse.json({ attemptId: attempt.id, questions }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_attempt_start_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt", handlePost);
