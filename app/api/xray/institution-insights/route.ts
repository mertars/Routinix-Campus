import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE, XRAY_MIN_GRADE } from "@/lib/mock-data";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/institution-insights?subject=Matematik — Faz O: kurum
// genelinde EN ÇOK "yapamadım" işaretlenen kazanımların sıralaması —
// müfredat/öğretim stratejisi için bir sinyal (bkz. checks/
// diagnosticComment metinleri, bu sorunun neyi eksik bıraktığını
// açıklıyor). JS tarafında agregasyon TERCİH EDİLDİ — kazanımId
// XrayPracticeQuestion'da, cevap XrayPracticeAnswer'da; Prisma groupBy
// ilişkili bir alana göre gruplamayı desteklemiyor, ham SQL yerine bu
// ölçekte (bir kurumun toplam yanlış cevap sayısı) JS agregasyonu hem
// yeterince hızlı hem çok daha okunaklı.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });

    const wrongAnswers = await prisma.xrayPracticeAnswer.findMany({
      where: {
        wasCorrect: false,
        question: { subject: subject.trim() },
        attempt: { student: { institutionId: session.institutionId, branch: { grade: { gte: XRAY_MIN_GRADE } } } },
      },
      select: {
        attempt: { select: { studentId: true } },
        question: { select: { kazanimId: true, subtopicId: true, checks: true } },
      },
    });

    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }

    const byKazanim = new Map<string, { subtopicId: string; checks: string; wrongCount: number; studentIds: Set<string> }>();
    for (const row of wrongAnswers) {
      const key = row.question.kazanimId;
      const entry = byKazanim.get(key) ?? { subtopicId: row.question.subtopicId, checks: row.question.checks, wrongCount: 0, studentIds: new Set() };
      entry.wrongCount++;
      entry.studentIds.add(row.attempt.studentId);
      byKazanim.set(key, entry);
    }

    const topKazanims = [...byKazanim.entries()]
      .map(([kazanimId, entry]) => ({
        kazanimId,
        subtopicId: entry.subtopicId,
        subtopicName: subtopicNameById.get(entry.subtopicId) ?? entry.subtopicId,
        checks: entry.checks,
        wrongCount: entry.wrongCount,
        studentCount: entry.studentIds.size,
      }))
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, 10);

    return NextResponse.json({ subject, topKazanims });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_institution_insights_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/institution-insights", handleGet);
