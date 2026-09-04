import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { matchSubtopicsForVideoTopic, subjectHasCurriculumBreakdown } from "@/lib/server/xray/video-topic-match";

export const dynamic = "force-dynamic";

// Kırmızı bölge eşiği — institution-overview.ts / xray-results-panel.tsx
// ile AYNI sabit (bkz. RED_ZONE_THRESHOLD oradaki tanım) — bu ekranda da
// "zayıf" AYNI anlama gelsin diye tekrar tanımlandı, tek bir paylaşılan
// sabite taşımak bu üç dosyayı gereksiz yere birbirine bağlardı.
const RED_ZONE_THRESHOLD = 30;

export type VideoRecommendation = {
  id: string;
  firstName: string;
  lastName: string;
  branchName: string;
  grade: number;
  masteryScore: number;
  subtopicName: string;
};

// GET /api/videos/[id]/recommendations — Kullanıcı talebi (2026-09-04):
// "video panelinde her öğrenciye öneriler olmalı, bu öğrenciye bunu
// atabilirsiniz". Videonun {subject, topic} bilgisini Röntgen'in
// CURRICULUM_TREE'sindeki alt konularla eşleştirip (bkz.
// video-topic-match.ts), o alt konu(lar)da masteryScore < 30 olan (henüz
// bu videoyu ALMAMIŞ) öğrencileri döndürür — VideoAssignModal bunu
// "Röntgen Önerisi" bölümünde gösterir. Röntgen SADECE Matematik/Fizik
// için alt konu kırılımına sahip olduğundan diğer dersler `supported:
// false` döner (UI bunu sessizce gizler, hata değildir).
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const video = await prisma.video.findUnique({
      where: { id: params.id },
      select: { id: true, institutionId: true, subject: true, topic: true, grade: true },
    });
    if (!video) return NextResponse.json({ error: "Video bulunamadı." }, { status: 404 });
    requireInstitution(session, video.institutionId);

    if (!subjectHasCurriculumBreakdown(video.subject)) {
      return NextResponse.json({ supported: false, matchedTopics: [], students: [] });
    }

    const matched = matchSubtopicsForVideoTopic(video.subject, video.topic);
    if (matched.length === 0) {
      return NextResponse.json({ supported: true, matchedTopics: [], students: [] });
    }

    const subtopicIds = matched.map((m) => m.subtopicId);
    const nameBySubtopicId = new Map(matched.map((m) => [m.subtopicId, m.name]));

    const [alreadyAssigned, weakRows] = await Promise.all([
      prisma.videoAssignment.findMany({ where: { videoId: video.id }, select: { studentId: true } }),
      prisma.topicMasteryAssessment.findMany({
        where: { subject: video.subject, subtopicId: { in: subtopicIds }, masteryScore: { lt: RED_ZONE_THRESHOLD } },
        select: { studentId: true, subtopicId: true, masteryScore: true },
      }),
    ]);
    const assignedIds = new Set(alreadyAssigned.map((a) => a.studentId));

    // Bir öğrencinin eşleşen birden fazla alt konuda skoru olabilir —
    // önerinin gerekçesi olarak EN DÜŞÜK (en zayıf) olanı tutuyoruz.
    const worstByStudent = new Map<string, { subtopicId: string; masteryScore: number }>();
    for (const row of weakRows) {
      if (assignedIds.has(row.studentId)) continue;
      const current = worstByStudent.get(row.studentId);
      if (!current || row.masteryScore < current.masteryScore) worstByStudent.set(row.studentId, row);
    }

    if (worstByStudent.size === 0) {
      return NextResponse.json({ supported: true, matchedTopics: matched.map((m) => m.name), students: [] });
    }

    // BİLEREK videonun sınıf seviyesine göre filtrelenmiyor — gerçek veride
    // üst sınıf öğrencilerinin alt sınıf konularından zayıf çıkması normal
    // (telafi/tekrar senaryosu, bkz. TopicMasteryAssessment'ta 12. sınıf bir
    // öğrencinin 9. sınıf alt konusunda skoru olması gibi) — bu durumda
    // önerilecek video TAM OLARAK aradığı telafi kaynağı olur. Şube/sınıf
    // bilgisi yine de UI'da gösteriliyor, yönetici gerekirse kendi takdirini
    // kullanır.
    const students = await prisma.student.findMany({
      where: { id: { in: [...worstByStudent.keys()] }, institutionId: video.institutionId, isActive: true },
      select: { id: true, firstName: true, lastName: true, branch: { select: { name: true, grade: true } } },
    });

    const result: VideoRecommendation[] = students
      .map((s) => {
        const worst = worstByStudent.get(s.id)!;
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          branchName: s.branch?.name ?? "",
          grade: s.branch?.grade ?? video.grade,
          masteryScore: worst.masteryScore,
          subtopicName: nameBySubtopicId.get(worst.subtopicId) ?? "",
        };
      })
      .sort((a, b) => a.masteryScore - b.masteryScore);

    return NextResponse.json({ supported: true, matchedTopics: matched.map((m) => m.name), students: result });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_recommendations_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Öneriler yüklenemedi." }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/videos/[id]/recommendations", handleGet);
