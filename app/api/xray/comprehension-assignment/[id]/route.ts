import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/comprehension-assignment/[id] — kilitli sınavı başlatır/
// devam ettirir. Şıkların isCorrect/diagnosis alanları BİLEREK gönderilmez
// (bkz. .../complete route'undaki sonuç açıklaması) — sadece label+text.
// İlk açılışta status ASSIGNED -> IN_PROGRESS'e geçer; COMPLETED/FLAGGED
// bir atamaya tekrar giriş YAPILAMAZ (kilitli sınav bir kez alınır).
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const assignment = await prisma.xrayComprehensionAssignment.findUnique({ where: { id: params.id } });
    if (!assignment) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, assignment.studentId);

    if (assignment.status === "COMPLETED" || assignment.status === "FLAGGED") {
      return NextResponse.json({ error: "Bu sınav zaten tamamlandı, tekrar girilemez." }, { status: 409 });
    }

    if (assignment.status === "ASSIGNED") {
      await prisma.xrayComprehensionAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    }

    const questions = await prisma.xrayComprehensionQuestion.findMany({
      where: { subject: assignment.subject, subtopicId: assignment.subtopicId },
      orderBy: { difficulty: "asc" },
      include: { options: { orderBy: { position: "asc" }, select: { id: true, label: true, text: true } } },
    });

    return NextResponse.json({
      assignmentId: assignment.id,
      subject: assignment.subject,
      questions: questions.map((q) => ({ id: q.id, difficulty: q.difficulty, prompt: q.prompt, options: q.options })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_comprehension_assignment_fetch_failed", { assignmentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/comprehension-assignment/[id]", handleGet);
