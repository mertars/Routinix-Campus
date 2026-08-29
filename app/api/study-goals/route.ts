import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_TARGET = 5000;
const HISTORY_TAKE = 30;

// UI'nin (pomodoro.tsx) gerçekten okuduğu alanlarla birebir — studyGoalId/
// createdAt istemciye hiç gitmiyor, include yerine select ile taşıma yükü azaltılıyor.
const TOPIC_GOAL_SELECT = {
  id: true,
  title: true,
  description: true,
  targetMinutes: true,
  targetQuestions: true,
  progressMinutes: true,
  progressQuestions: true,
  isCompleted: true,
} as const;

// GİZLİLİK KURALI: bu uçlar SADECE oturum sahibi öğrencinin kendi verisine
// erişmesine izin verir — session.sub !== studentId ise 404 (öğretmen/veli/
// yönetici erişimi buraya HİÇ eklenmez, bkz. schema.prisma'daki not).
function assertIsOwnStudent(session: { role: string; sub: string }, studentId: string) {
  if (session.role !== "STUDENT" || session.sub !== studentId) {
    throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
  }
}

// GET /api/study-goals?studentId=X — { active, history }. active: tamamlanmamış
// tek hedef (topicGoals'la birlikte) ya da null. history: tamamlanmış hedefler,
// en yeniden eskiye, "Geçmiş Hedeflerim" için.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    assertIsOwnStudent(session, studentId);

    const [active, history] = await Promise.all([
      prisma.studyGoal.findFirst({
        where: { studentId, isCompleted: false },
        include: { topicGoals: { orderBy: { createdAt: "asc" }, select: TOPIC_GOAL_SELECT } },
      }),
      prisma.studyGoal.findMany({
        where: { studentId, isCompleted: true },
        include: { topicGoals: { orderBy: { createdAt: "asc" }, select: TOPIC_GOAL_SELECT } },
        orderBy: { completedAt: "desc" },
        take: HISTORY_TAKE,
      }),
    ]);

    return NextResponse.json({ active, history });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("study_goals_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/study-goals — { targetQuestions?, targetMinutes? } yeni bir genel
// hedef başlatır. Zaten aktif bir hedef varsa (en az biri belirtilmiş olsa
// bile) o hedef otomatik "tamamlandı" sayılıp Geçmiş Hedeflerim'e düşer —
// öğrenci aynı anda sadece TEK bir aktif genel hedef takip eder.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "STUDENT") {
      return NextResponse.json({ error: "Sadece öğrenciler hedef belirleyebilir." }, { status: 403 });
    }
    const studentId = session.sub;

    const body = await request.json();
    const { targetQuestions, targetMinutes } = body as { targetQuestions?: unknown; targetMinutes?: unknown };
    const q = targetQuestions === undefined || targetQuestions === null ? null : Number(targetQuestions);
    const m = targetMinutes === undefined || targetMinutes === null ? null : Number(targetMinutes);

    if ((q !== null && (!Number.isFinite(q) || q < 0 || q > MAX_TARGET)) || (m !== null && (!Number.isFinite(m) || m < 0 || m > MAX_TARGET))) {
      return NextResponse.json({ error: `Hedef değerleri 0-${MAX_TARGET} arasında olmalı.` }, { status: 400 });
    }
    if (q === null && m === null) {
      return NextResponse.json({ error: "En az bir hedef (soru veya süre) girilmeli." }, { status: 400 });
    }

    const goal = await prisma.$transaction(async (tx) => {
      await tx.studyGoal.updateMany({
        where: { studentId, isCompleted: false },
        data: { isCompleted: true, completedAt: new Date() },
      });
      return tx.studyGoal.create({
        data: { studentId, targetQuestions: q, targetMinutes: m },
        include: { topicGoals: { select: TOPIC_GOAL_SELECT } },
      });
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("study_goal_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/study-goals", handleGet);
export const POST = withApiLogging("POST /api/study-goals", handlePost);
