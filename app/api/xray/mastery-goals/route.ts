import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/mastery-goals?studentId=X — Faz P: Pomodoro'nun "kalıcı
// hedef kartları" desenini Akademik Röntgen'e uyarlar. Sahiplik kuralı
// GET /api/xray/results/[studentId] ile BİREBİR aynı. Aktif (achievedAt
// NULL) her hedef için güncel skor >= targetScore ise BURADA, okuma
// anında (lazy) achievedAt işaretlenir — ayrı bir cron/arka plan işi
// GEREKMEZ, zaten her hedef en fazla bu uç çağrıldığında kontrol edilir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, studentId);

    const goals = await prisma.xrayMasteryGoal.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
    const assessments = await prisma.topicMasteryAssessment.findMany({
      where: { studentId, subtopicId: { in: goals.map((g) => g.subtopicId) } },
      select: { subtopicId: true, masteryScore: true },
    });
    const scoreBySubtopic = new Map(assessments.map((a) => [a.subtopicId, a.masteryScore]));

    const toAchieve: string[] = [];
    const results = goals.map((g) => {
      const currentScore = scoreBySubtopic.get(g.subtopicId) ?? null;
      let achievedAt = g.achievedAt;
      if (!achievedAt && currentScore !== null && currentScore >= g.targetScore) {
        achievedAt = new Date();
        toAchieve.push(g.id);
      }
      const topics = CURRICULUM_TREE[g.subject] ?? [];
      const subtopicName = topics.flatMap((t) => t.subtopics).find((s) => s.id === g.subtopicId)?.name ?? g.subtopicId;
      return {
        id: g.id,
        subject: g.subject,
        subtopicId: g.subtopicId,
        subtopicName,
        targetScore: g.targetScore,
        currentScore,
        createdByRole: g.createdByRole,
        createdAt: g.createdAt.toISOString(),
        achievedAt: achievedAt?.toISOString() ?? null,
      };
    });

    if (toAchieve.length > 0) {
      await prisma.xrayMasteryGoal.updateMany({ where: { id: { in: toAchieve } }, data: { achievedAt: new Date() } });
    }

    return NextResponse.json({ goals: results });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_mastery_goals_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/xray/mastery-goals — { studentId?, subject, subtopicId,
// targetScore } — öğrenci SADECE kendine hedef koyabilir (studentId
// gövdede verilse bile YOK SAYILIR, her zaman session.sub kullanılır);
// öğretmen/yönetici belirttiği öğrenciye hedef koyabilir (kullanıcının
// "öğrenci/veli/öğretmenin birlikte koyduğu hedef" isteği — veli SADECE
// görüntüler, oluşturamaz, mevcut veli rolü zaten genelde salt-okunur).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "STUDENT" && session.role !== "TEACHER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }

    const body = await request.json();
    const { studentId: bodyStudentId, subject, subtopicId, targetScore } = body as {
      studentId?: string;
      subject?: string;
      subtopicId?: string;
      targetScore?: number;
    };
    const studentId = session.role === "STUDENT" ? session.sub : bodyStudentId;
    if (!studentId || !subject?.trim() || !subtopicId?.trim() || !targetScore) {
      return NextResponse.json({ error: "studentId, subject, subtopicId ve targetScore zorunludur." }, { status: 400 });
    }
    const clampedTarget = Math.max(1, Math.min(100, Math.round(targetScore)));

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);

    const goal = await prisma.xrayMasteryGoal.create({
      data: { studentId, subject: subject.trim(), subtopicId: subtopicId.trim(), targetScore: clampedTarget, createdByRole: session.role },
    });

    return NextResponse.json({ goalId: goal.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_mastery_goal_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/mastery-goals", handleGet);
export const POST = withApiLogging("POST /api/xray/mastery-goals", handlePost);
