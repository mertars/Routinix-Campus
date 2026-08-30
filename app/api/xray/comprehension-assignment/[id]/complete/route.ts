import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/comprehension-assignment/[id]/complete — sınavı bitirir.
// Öğrenciye SADECE kaç doğru yaptığı döner — şık bazlı tanı (diagnosis)
// öğrenciye değil, atayan yöneticiye/öğretmene gider (bkz. XrayResultsPanel
// > XrayComprehensionResults, Faz D). Bu, gerçek ürünün "sonuç 3 iş günü
// içinde değerlendirilir" mantığına denk düşer — anlık kendi kendine
// yorumlama yerine. (Faz D) Ayrıca bir masteryScore hesaplanıp
// TopicMasteryAssessment'a upsert edilir (source=LOCKED_EXAM — en
// güvenilir kaynak, gözetimli sınav sonucu).
async function handlePost(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const assignment = await prisma.xrayComprehensionAssignment.findUnique({ where: { id: params.id } });
    if (!assignment) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, assignment.studentId);
    if (assignment.status !== "IN_PROGRESS") return NextResponse.json({ error: "Bu sınav aktif değil." }, { status: 409 });

    const [totalQuestions, answers] = await Promise.all([
      prisma.xrayComprehensionQuestion.count({ where: { subject: assignment.subject, subtopicId: assignment.subtopicId } }),
      prisma.xrayComprehensionAnswer.findMany({ where: { assignmentId: assignment.id }, select: { selectedOption: { select: { isCorrect: true } } } }),
    ]);
    const correct = answers.filter((a) => a.selectedOption.isCorrect).length;

    await prisma.xrayComprehensionAssignment.update({ where: { id: assignment.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    if (answers.length > 0) {
      const masteryScore = Math.round((correct / answers.length) * 100);
      await prisma.topicMasteryAssessment.upsert({
        where: { studentId_subtopicId: { studentId: assignment.studentId, subtopicId: assignment.subtopicId } },
        create: { studentId: assignment.studentId, subject: assignment.subject, subtopicId: assignment.subtopicId, masteryScore, source: "LOCKED_EXAM" },
        update: { masteryScore, source: "LOCKED_EXAM", sourceSessionId: null, assessedAt: new Date() },
      });
      await prisma.topicMasteryHistory.create({
        data: { studentId: assignment.studentId, subject: assignment.subject, subtopicId: assignment.subtopicId, masteryScore, source: "LOCKED_EXAM" },
      });
    }

    return NextResponse.json({ total: totalQuestions, answered: answers.length, correct });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_comprehension_complete_failed", { assignmentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/comprehension-assignment/[id]/complete", handlePost);
