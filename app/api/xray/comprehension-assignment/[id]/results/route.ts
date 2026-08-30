import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireInstitution, assertTeacherOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/comprehension-assignment/[id]/results — Faz D: yönetici/
// öğretmenin gördüğü ZENGİN sonuç — her sorunun hangi şıkla cevaplandığı
// VE o şıkkın "diagnosis" metni (bkz. XrayComprehensionOption.diagnosis).
// Öğrenciye DÖNMEZ (bkz. .../complete route'undaki gerekçe) — bu SADECE
// atayan tarafın görebileceği bir uç. Sınav henüz bitmemişse (ASSIGNED/
// IN_PROGRESS) boş bir sonuç döner.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const assignment = await prisma.xrayComprehensionAssignment.findUnique({ where: { id: params.id } });
    if (!assignment) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });

    const student = await prisma.student.findUnique({ where: { id: assignment.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, assignment.studentId);
    else if (session.role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

    if (assignment.status === "ASSIGNED" || assignment.status === "IN_PROGRESS") {
      return NextResponse.json({ status: assignment.status, questions: [] });
    }

    const questions = await prisma.xrayComprehensionQuestion.findMany({
      where: { subject: assignment.subject, subtopicId: assignment.subtopicId },
      orderBy: { difficulty: "asc" },
      include: { options: { orderBy: { position: "asc" } } },
    });
    const answers = await prisma.xrayComprehensionAnswer.findMany({
      where: { assignmentId: assignment.id },
      select: { questionId: true, selectedOptionId: true },
    });
    const selectedByQuestion = new Map(answers.map((a) => [a.questionId, a.selectedOptionId]));

    const items = questions.map((q) => {
      const selectedOptionId = selectedByQuestion.get(q.id) ?? null;
      const selectedOption = q.options.find((o) => o.id === selectedOptionId) ?? null;
      return {
        questionId: q.id,
        prompt: q.prompt,
        solution: q.solution,
        answered: selectedOption !== null,
        isCorrect: selectedOption?.isCorrect ?? null,
        selectedLabel: selectedOption?.label ?? null,
        selectedText: selectedOption?.text ?? null,
        diagnosis: selectedOption?.diagnosis ?? null,
      };
    });

    return NextResponse.json({ status: assignment.status, flagReason: assignment.flagReason, questions: items });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_comprehension_results_failed", { assignmentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/comprehension-assignment/[id]/results", handleGet);
