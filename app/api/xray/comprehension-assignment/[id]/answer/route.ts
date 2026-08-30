import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/comprehension-assignment/[id]/answer — { questionId, selectedOptionId } —
// isCorrect/diagnosis İSTEMCİYE dönmez (kilitli sınav sırasında anlık geri
// bildirim YOK — bkz. gerçek ürünün sınav mantığı, sonuç ancak bitince).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const assignment = await prisma.xrayComprehensionAssignment.findUnique({ where: { id: params.id } });
    if (!assignment) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, assignment.studentId);
    if (assignment.status !== "IN_PROGRESS") return NextResponse.json({ error: "Bu sınav aktif değil." }, { status: 409 });

    const body = await request.json();
    const { questionId, selectedOptionId } = body as { questionId?: string; selectedOptionId?: string };
    if (!questionId || !selectedOptionId) return NextResponse.json({ error: "questionId ve selectedOptionId zorunludur." }, { status: 400 });

    const option = await prisma.xrayComprehensionOption.findUnique({ where: { id: selectedOptionId } });
    if (!option || option.questionId !== questionId) return NextResponse.json({ error: "Geçersiz şık." }, { status: 400 });

    await prisma.xrayComprehensionAnswer.upsert({
      where: { assignmentId_questionId: { assignmentId: assignment.id, questionId } },
      create: { assignmentId: assignment.id, questionId, selectedOptionId },
      update: { selectedOptionId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_comprehension_answer_failed", { assignmentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/comprehension-assignment/[id]/answer", handlePost);
