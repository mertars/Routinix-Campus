import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireInstitution, assertTeacherOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-attempt/[id]/results — yönetici/öğretmenin gördüğü
// Test 1 sonucu: her sorunun cevabı/çözümü VE öğrencinin "Yapamadıklarım"
// öz-bildirimine göre doğru/yanlış sayılıp sayılmadığı (bkz.
// comprehension-assignment/[id]/results'taki BİREBİR AYNI yetki deseni).
// Sınav henüz bitmemişse (ASSIGNED/IN_PROGRESS) boş bir sonuç döner.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: params.id } });
    if (!attempt) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });

    const student = await prisma.student.findUnique({ where: { id: attempt.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, attempt.studentId);
    else if (session.role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

    if (attempt.status === "ASSIGNED" || attempt.status === "IN_PROGRESS") {
      return NextResponse.json({ status: attempt.status, questions: [] });
    }

    const attemptQuestions = await prisma.xrayPracticeAttemptQuestion.findMany({
      where: { attemptId: attempt.id },
      orderBy: { order: "asc" },
      include: { question: { select: { id: true, prompt: true, correctAnswer: true, solution: true, checks: true } } },
    });
    const answers = await prisma.xrayPracticeAnswer.findMany({
      where: { attemptId: attempt.id },
      select: { questionId: true, wasCorrect: true },
    });
    const correctByQuestion = new Map(answers.map((a) => [a.questionId, a.wasCorrect]));

    const questions = attemptQuestions.map((aq) => ({
      questionId: aq.question.id,
      order: aq.order,
      prompt: aq.question.prompt,
      correctAnswer: aq.question.correctAnswer,
      solution: aq.question.solution,
      checks: aq.question.checks,
      wasCorrect: correctByQuestion.get(aq.question.id) ?? null,
    }));

    return NextResponse.json({ status: attempt.status, questions });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_results_failed", { attemptId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-attempt/[id]/results", handleGet);
