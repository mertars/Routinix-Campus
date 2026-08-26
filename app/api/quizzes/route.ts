import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/quizzes — öğretmen bir Pop-Quiz fırlatır (stage=LIVE).
// teacherId body'den DEĞİL oturumdan alınır (bir öğretmen başka bir öğretmen
// adına quiz açamaz). Body: { branchId, name, durationSeconds, questions }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const teacherId = session.sub;

    const body = await request.json();
    const { branchId, name, durationSeconds, questions } = body as {
      branchId?: string;
      name?: string;
      durationSeconds?: number;
      questions?: { imageLabel: string; answer: string }[];
    };

    if (!branchId || !name?.trim() || !durationSeconds || !Array.isArray(questions) || questions.length < 5) {
      return NextResponse.json({ error: "branchId, name, durationSeconds ve en az 5 soru zorunludur." }, { status: 400 });
    }
    if (questions.some((q) => !q.imageLabel?.trim() || !q.answer?.trim())) {
      return NextResponse.json({ error: "Her sorunun görsel etiketi ve cevabı olmalı." }, { status: 400 });
    }

    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    // Aynı şubede zaten canlı bir quiz varsa üzerine yenisini açma.
    const existingLive = await prisma.quiz.findFirst({ where: { branchId, stage: "LIVE" } });
    if (existingLive) {
      return NextResponse.json({ error: "Bu şubede zaten canlı bir Pop-Quiz var." }, { status: 409 });
    }

    const quiz = await prisma.quiz.create({
      data: {
        teacherId,
        branchId,
        name: name.trim(),
        durationSeconds,
        questions: { create: questions.map((q, i) => ({ imageLabel: q.imageLabel.trim(), answer: q.answer.trim(), position: i })) },
      },
      include: { questions: true },
    });

    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("quiz_launch_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/quizzes?feed=true&limit=N — yönetici canlı akışı için son biten
// (ENDED) quiz'leri, yanıt sayılarıyla birlikte döner.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const isFeed = request.nextUrl.searchParams.get("feed") === "true";
    if (!isFeed) {
      return NextResponse.json({ error: "Şu an sadece ?feed=true destekleniyor." }, { status: 400 });
    }
    const limit = Math.min(20, Number(request.nextUrl.searchParams.get("limit") ?? "4") || 4);

    const quizzes = await prisma.quiz.findMany({
      where: { stage: "ENDED", branch: { institutionId: session.institutionId } },
      orderBy: { endedAt: "desc" },
      take: limit,
      include: { branch: { select: { name: true } }, submissions: { select: { id: true } } },
    });

    const results = quizzes.map((quiz) => ({
      id: quiz.id,
      quizName: quiz.name,
      branchName: quiz.branch.name,
      responseCount: quiz.submissions.length,
      sentAt: quiz.endedAt?.toISOString() ?? quiz.launchedAt.toISOString(),
    }));

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("quiz_feed_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/quizzes", handlePost);
export const GET = withApiLogging("GET /api/quizzes", handleGet);
