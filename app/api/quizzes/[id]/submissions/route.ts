import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/quizzes/:id/submissions — öğrenci KENDİ yanıtlarını gönderir,
// sunucu cevap anahtarıyla karşılaştırıp puanlar (cevap anahtarı hiçbir
// zaman istemciye gönderilmedi — bkz. /api/quizzes/active). Body'deki
// studentId GÜVENİLMEZ — oturum sahibinin id'siyle EZİLİR, aksi halde bir
// öğrenci başka bir öğrenci adına puan yazabilirdi. Body: { answers: [...] }
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");
    const studentId = session.sub;

    const body = await request.json();
    const { answers } = body as { answers?: { questionId: string; value: string }[] };

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: "answers zorunludur." }, { status: 400 });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: params.id },
      include: { questions: true, branch: { select: { institutionId: true } } },
    });
    if (!quiz || quiz.branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Quiz bulunamadı." }, { status: 404 });
    }

    // institutionId eşleşmesi tek başına yeterli değil — aynı kurumun
    // BAŞKA bir şubesindeki öğrenci quiz id'sini bilse bile yanıt gönderemez.
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { branchId: true } });
    if (!student || student.branchId !== quiz.branchId) {
      return NextResponse.json({ error: "Quiz bulunamadı." }, { status: 404 });
    }

    let correct = 0;
    for (const question of quiz.questions) {
      const given = answers.find((a) => a.questionId === question.id)?.value ?? "";
      if (given.trim().toLocaleLowerCase("tr") === question.answer.trim().toLocaleLowerCase("tr")) correct += 1;
    }
    const wrong = quiz.questions.length - correct;

    const submission = await prisma.quizSubmission.upsert({
      where: { quizId_studentId: { quizId: params.id, studentId } },
      update: { correct, wrong },
      create: { quizId: params.id, studentId, correct, wrong },
    });

    return NextResponse.json({ submission });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("quiz_submission_failed", { quizId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/quizzes/[id]/submissions", handlePost);
