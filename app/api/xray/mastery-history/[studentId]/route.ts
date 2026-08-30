import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { computeOverallTrend, computeSubtopicSeries, computePeriodComparison, computeHeatmap } from "@/lib/server/xray/mastery-trend";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/mastery-history/[studentId]?subject=Matematik — Faz J:
// TopicMasteryHistory'deki ham kayıtlardan analiz ekranındaki trend
// grafiklerinin ihtiyaç duyduğu 4 hazır yapıyı üretir (bkz.
// lib/server/xray/mastery-trend.ts'teki saf fonksiyonlar). Sahiplik kuralı
// GET /api/xray/results/[studentId] ile BİREBİR aynı.
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();

    const student = await prisma.student.findUnique({ where: { id: params.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, params.studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, params.studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, params.studentId);

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });

    const history = await prisma.topicMasteryHistory.findMany({
      where: { studentId: params.studentId, subject },
      select: { subtopicId: true, masteryScore: true, assessedAt: true },
      orderBy: { assessedAt: "asc" },
    });

    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }
    const nameFor = (subtopicId: string) => subtopicNameById.get(subtopicId) ?? subtopicId;

    const overallTrend = computeOverallTrend(history).map((p) => ({ ...p, subtopicName: nameFor(p.subtopicId) }));
    const perSubtopic = computeSubtopicSeries(history).map((s) => ({ ...s, subtopicName: nameFor(s.subtopicId) }));
    const periodComparison = computePeriodComparison(history).map((r) => ({ ...r, subtopicName: nameFor(r.subtopicId) }));
    const heatmapRaw = computeHeatmap(history);
    const heatmap = { months: heatmapRaw.months, rows: heatmapRaw.rows.map((r) => ({ ...r, subtopicName: nameFor(r.subtopicId) })) };

    return NextResponse.json({ subject, overallTrend, perSubtopic, periodComparison, heatmap });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_mastery_history_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/mastery-history/[studentId]", handleGet);
