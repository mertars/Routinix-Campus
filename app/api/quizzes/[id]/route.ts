import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// Bir quiz'in cevap anahtarını/yanıtlarını SADECE onu açan öğretmen ya da
// aynı kurumdaki bir yönetici görebilir — quiz'in institutionId'si Branch
// üzerinden dolaylıdır (bkz. prisma/schema.prisma > Quiz.branch notu).
async function assertQuizAccess(session: { role: string; sub: string; institutionId: string }, teacherId: string, branchInstitutionId: string) {
  if (session.institutionId !== branchInstitutionId) {
    throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
  }
  if (session.role === "TEACHER" && session.sub !== teacherId) {
    throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
  }
  if (session.role === "STUDENT" || session.role === "PARENT") {
    throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
  }
}

// GET /api/quizzes/:id — quiz'i AÇAN öğretmenin kendi canlı ekranı için tam
// detay (sorular + cevap anahtarı + o ana kadarki yanıtlar). Bu endpoint
// öğrenci tarafından çağrılmaz — öğrenciler cevapsız görünüm için
// /api/quizzes/active kullanır.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const quiz = await prisma.quiz.findUnique({
      where: { id: params.id },
      include: {
        questions: { orderBy: { position: "asc" } },
        submissions: { include: { student: { select: { firstName: true, lastName: true } } } },
        branch: { select: { institutionId: true } },
      },
    });
    if (!quiz) return NextResponse.json({ error: "Quiz bulunamadı." }, { status: 404 });
    await assertQuizAccess(session, quiz.teacherId, quiz.branch.institutionId);

    return NextResponse.json({ quiz });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("quiz_detail_failed", { quizId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/quizzes/:id — quiz'i sonlandırır (stage=ENDED) ve sorularını
// öğretmenin tekrar kullanılabilir soru bankasına ekler.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const body = await request.json().catch(() => ({}));
    if (body?.stage !== "ENDED") {
      return NextResponse.json({ error: "Sadece stage: 'ENDED' destekleniyor." }, { status: 400 });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: params.id },
      include: { questions: true, branch: { select: { institutionId: true } } },
    });
    if (!quiz) return NextResponse.json({ error: "Quiz bulunamadı." }, { status: 404 });
    await assertQuizAccess(session, quiz.teacherId, quiz.branch.institutionId);

    await prisma.$transaction([
      prisma.quiz.update({ where: { id: params.id }, data: { stage: "ENDED", endedAt: new Date() } }),
      prisma.quizBankQuestion.createMany({
        data: quiz.questions.map((q) => ({ teacherId: quiz.teacherId, imageLabel: q.imageLabel, answer: q.answer })),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("quiz_end_failed", { quizId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/quizzes/[id]", handleGet);
export const PATCH = withApiLogging("PATCH /api/quizzes/[id]", handlePatch);
