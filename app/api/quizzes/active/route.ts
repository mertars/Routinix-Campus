import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/quizzes/active?branchId=X — öğrenci tarafının canlı Pop-Quiz
// yoklaması için kullandığı, CEVAP ANAHTARI İÇERMEYEN uç nokta. "Bu öğrenci
// zaten yanıtladı mı" kontrolü STUDENT rolünde her zaman oturum sahibinin
// kendi id'sine göre yapılır (query'den studentId GÜVENİLMEZ).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const branchId = request.nextUrl.searchParams.get("branchId");
    if (!branchId) {
      return NextResponse.json({ error: "branchId parametresi zorunludur." }, { status: 400 });
    }
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ quiz: null });
    }
    const studentId = session.role === "STUDENT" ? session.sub : null;

    const quiz = await prisma.quiz.findFirst({
      where: { branchId, stage: "LIVE" },
      include: { questions: { orderBy: { position: "asc" }, select: { id: true, imageLabel: true } } },
    });

    if (!quiz) return NextResponse.json({ quiz: null });

    const elapsedSeconds = Math.floor((Date.now() - quiz.launchedAt.getTime()) / 1000);
    if (elapsedSeconds >= quiz.durationSeconds) {
      return NextResponse.json({ quiz: null });
    }

    let alreadySubmitted = false;
    if (studentId) {
      const submission = await prisma.quizSubmission.findUnique({
        where: { quizId_studentId: { quizId: quiz.id, studentId } },
        select: { id: true },
      });
      alreadySubmitted = !!submission;
    }

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        name: quiz.name,
        branchId: quiz.branchId,
        durationSeconds: quiz.durationSeconds,
        launchedAt: quiz.launchedAt.toISOString(),
        questions: quiz.questions,
      },
      alreadySubmitted,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("quiz_active_lookup_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/quizzes/active", handleGet);
