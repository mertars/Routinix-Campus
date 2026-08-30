import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeOverallTrend, computeOverallDelta } from "@/lib/server/xray/mastery-trend";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/my-mastery-trend — Faz M: öğrencinin KENDİ paneli için
// "geçen aya göre %X arttın" tarzı pozitif pekiştirme kartı. Akran
// kıyaslaması BİLİNÇLİ OLARAK YOK (hassas bir alan) — SADECE öğrencinin
// kendi geçmişiyle karşılaştırma. studentId parametre olarak ALINMAZ,
// session.sub kullanılır — bu uç SADECE "kendi" verinize erişim sağlar.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const history = await prisma.topicMasteryHistory.findMany({
      where: { studentId: session.sub },
      select: { subject: true, subtopicId: true, masteryScore: true, assessedAt: true },
      orderBy: { assessedAt: "asc" },
    });

    const bySubject = new Map<string, typeof history>();
    for (const row of history) {
      const list = bySubject.get(row.subject) ?? [];
      list.push(row);
      bySubject.set(row.subject, list);
    }

    const subjects = [...bySubject.entries()]
      .map(([subject, rows]) => {
        const { current, delta } = computeOverallDelta(rows);
        const sparkline = computeOverallTrend(rows).map((p) => ({ assessedAt: p.assessedAt, average: p.average }));
        const lastAssessedAt = rows[rows.length - 1].assessedAt.toISOString();
        return { subject, current, delta, sparkline, lastAssessedAt };
      })
      .sort((a, b) => (a.lastAssessedAt < b.lastAssessedAt ? 1 : -1));

    return NextResponse.json({ subjects });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_my_mastery_trend_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/my-mastery-trend", handleGet);
