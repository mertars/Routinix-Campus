import { NextResponse } from "next/server";
import { buildRoadmapForAllSubjects } from "@/lib/server/xray/roadmap";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

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
//
// Faz Q — hesaplama mantığı lib/server/xray/roadmap.ts'e taşındı (yönetici
// ekranı için eklenen /api/xray/roadmap/[studentId] ile PAYLAŞILIYOR).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const subjects = await buildRoadmapForAllSubjects(session.sub);
    return NextResponse.json({ subjects });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("xray_my_roadmap_failed", error);
  }
}

export const GET = withApiLogging("GET /api/xray/my-roadmap", handleGet);
