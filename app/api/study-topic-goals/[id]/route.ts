import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// PATCH /api/study-topic-goals/:id — { addQuestions?, addMinutes?, complete? }
// bir konu/görev hedefinin ilerlemesini günceller. Sahiplik, hedefin bağlı
// olduğu StudyGoal.studentId üzerinden zincirlenerek doğrulanır.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    if (session.role !== "STUDENT") return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });

    const existing = await prisma.studyTopicGoal.findUnique({
      where: { id: params.id },
      select: { studyGoal: { select: { studentId: true } } },
    });
    if (!existing || existing.studyGoal.studentId !== session.sub) {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const { addQuestions, addMinutes, complete } = body as { addQuestions?: unknown; addMinutes?: unknown; complete?: unknown };
    const qDelta = Number(addQuestions);
    const mDelta = Number(addMinutes);

    const topicGoal = await prisma.studyTopicGoal.update({
      where: { id: params.id },
      data: {
        ...(Number.isFinite(qDelta) && qDelta !== 0 ? { progressQuestions: { increment: qDelta } } : {}),
        ...(Number.isFinite(mDelta) && mDelta !== 0 ? { progressMinutes: { increment: mDelta } } : {}),
        ...(complete === true ? { isCompleted: true } : {}),
      },
    });

    return NextResponse.json({ topicGoal });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("study_topic_goal_update_failed", { id: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/study-topic-goals/[id]", handlePatch);
