import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { generateXrayRecommendations, summarizeXrayDiagnosis } from "@/lib/server/xray/recommendations";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/my-roadmap — Faz P: rakip araştırmasında ("Matematik
// Röntgeni") bulunan boşluğu kapatır. generateXrayRecommendations/
// summarizeXrayDiagnosis (bkz. lib/server/xray/recommendations.ts) ŞİMDİYE
// KADAR sadece /api/xray/report/[studentId]'nin ürettiği PDF'te
// kullanılıyordu — öğrenci bu "sırada ne çalışmalıyım" önerisini kendi
// panelinde HİÇ görmüyordu. Bu uç, my-mastery-trend/route.ts ile AYNI
// desende (studentId parametre olarak ALINMAZ, session.sub kullanılır —
// SADECE "kendi" verinize erişim), aynı reçete motorunu EKRANA (JSON)
// döker; report route'undaki PDF/react-pdf bağımlılığı burada YOK.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const assessments = await prisma.topicMasteryAssessment.findMany({
      where: { studentId: session.sub },
      select: { subject: true, subtopicId: true, masteryScore: true },
    });

    const bySubject = new Map<string, typeof assessments>();
    for (const row of assessments) {
      const list = bySubject.get(row.subject) ?? [];
      list.push(row);
      bySubject.set(row.subject, list);
    }

    const subjects = [...bySubject.entries()].map(([subject, rows]) => {
      const subtopicNameById = new Map<string, string>();
      for (const topic of CURRICULUM_TREE[subject] ?? []) {
        for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
      }
      const diagnoses = rows.map((r) => ({ subtopicId: r.subtopicId, name: subtopicNameById.get(r.subtopicId) ?? r.subtopicId, masteryScore: r.masteryScore }));
      const recommendations = generateXrayRecommendations(diagnoses);
      const summary = summarizeXrayDiagnosis(recommendations);
      return { subject, summary, recommendations };
    });

    return NextResponse.json({ subjects });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_my_roadmap_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/my-roadmap", handleGet);
