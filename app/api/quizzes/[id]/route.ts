import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

// GET /api/quizzes/:id — quiz'i AÇAN öğretmenin kendi canlı ekranı için tam
// detay (sorular + cevap anahtarı + o ana kadarki yanıtlar). Bu endpoint
// öğrenci tarafından çağrılmaz — öğrenciler cevapsız görünüm için
// /api/quizzes/active kullanır.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: params.id },
      include: {
        questions: { orderBy: { position: "asc" } },
        submissions: { include: { student: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!quiz) return NextResponse.json({ error: "Quiz bulunamadı." }, { status: 404 });
    return NextResponse.json({ quiz });
  } catch (error) {
    logger.error("quiz_detail_failed", { quizId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/quizzes/:id — quiz'i sonlandırır (stage=ENDED) ve sorularını
// öğretmenin tekrar kullanılabilir soru bankasına ekler.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.stage !== "ENDED") {
      return NextResponse.json({ error: "Sadece stage: 'ENDED' destekleniyor." }, { status: 400 });
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: params.id }, include: { questions: true } });
    if (!quiz) return NextResponse.json({ error: "Quiz bulunamadı." }, { status: 404 });

    await prisma.$transaction([
      prisma.quiz.update({ where: { id: params.id }, data: { stage: "ENDED", endedAt: new Date() } }),
      prisma.quizBankQuestion.createMany({
        data: quiz.questions.map((q) => ({ teacherId: quiz.teacherId, imageLabel: q.imageLabel, answer: q.answer })),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("quiz_end_failed", { quizId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/quizzes/[id]", handleGet);
export const PATCH = withApiLogging("PATCH /api/quizzes/[id]", handlePatch);
