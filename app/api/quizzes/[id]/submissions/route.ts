import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/quizzes/:id/submissions — öğrenci yanıtlarını gönderir, sunucu
// cevap anahtarıyla karşılaştırıp puanlar (cevap anahtarı hiçbir zaman
// istemciye gönderilmedi — bkz. /api/quizzes/active). Body:
// { studentId, answers: [{ questionId, value }] }
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { studentId, answers } = body as { studentId?: string; answers?: { questionId: string; value: string }[] };

    if (!studentId || !Array.isArray(answers)) {
      return NextResponse.json({ error: "studentId ve answers zorunludur." }, { status: 400 });
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: params.id }, include: { questions: true } });
    if (!quiz) return NextResponse.json({ error: "Quiz bulunamadı." }, { status: 404 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

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
    logger.error("quiz_submission_failed", { quizId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/quizzes/[id]/submissions", handlePost);
