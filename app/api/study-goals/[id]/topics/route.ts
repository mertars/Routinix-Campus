import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_TARGET = 5000;

// POST /api/study-goals/:id/topics — { title, description?, targetMinutes?,
// targetQuestions? } genel hedefin altına özel bir konu/görev hedefi ekler
// (örn. "Trigonometri" — 30 dk — 20 soru — "Çıkmış sorular çözülecek").
// SADECE hedefin sahibi öğrenci, SADECE hedef hâlâ aktifse ekleyebilir.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    if (session.role !== "STUDENT") return NextResponse.json({ error: "Hedef bulunamadı." }, { status: 404 });

    const goal = await prisma.studyGoal.findUnique({ where: { id: params.id }, select: { studentId: true, isCompleted: true } });
    if (!goal || goal.studentId !== session.sub) {
      return NextResponse.json({ error: "Hedef bulunamadı." }, { status: 404 });
    }
    if (goal.isCompleted) {
      return NextResponse.json({ error: "Tamamlanmış bir hedefe yeni konu hedefi eklenemez." }, { status: 409 });
    }

    const body = await request.json();
    const { title, description, targetMinutes, targetQuestions } = body as {
      title?: string;
      description?: string;
      targetMinutes?: unknown;
      targetQuestions?: unknown;
    };
    if (!title?.trim()) return NextResponse.json({ error: "title zorunludur." }, { status: 400 });

    const m = targetMinutes === undefined || targetMinutes === null || targetMinutes === "" ? null : Number(targetMinutes);
    const q = targetQuestions === undefined || targetQuestions === null || targetQuestions === "" ? null : Number(targetQuestions);
    if ((m !== null && (!Number.isFinite(m) || m < 0 || m > MAX_TARGET)) || (q !== null && (!Number.isFinite(q) || q < 0 || q > MAX_TARGET))) {
      return NextResponse.json({ error: `Hedef değerleri 0-${MAX_TARGET} arasında olmalı.` }, { status: 400 });
    }

    const topicGoal = await prisma.studyTopicGoal.create({
      data: {
        studyGoalId: params.id,
        title: title.trim(),
        description: description?.trim() || null,
        targetMinutes: m,
        targetQuestions: q,
      },
    });

    return NextResponse.json({ topicGoal }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("study_topic_goal_create_failed", { studyGoalId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/study-goals/[id]/topics", handlePost);
