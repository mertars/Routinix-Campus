import { prisma } from "@/lib/server/prisma";
import { matchSubtopicsForVideoTopic } from "./video-topic-match";

const RED_ZONE_THRESHOLD = 30;
const XRAY_VIDEO_SUBJECTS = ["Matematik", "Fizik"] as const;

export type VideoRecommendationOverviewItem = {
  videoId: string;
  studentCount: number;
  topSubtopicName: string;
  sampleNames: string[];
};

// Kullanıcı talebi (2026-09-04) — "ben ata menüsüne değil direkt video
// panelinde bir öneri bekliyorum": /api/videos/[id]/recommendations TEK
// bir videoyu açtığında kimin zayıf olduğunu söylüyordu (bkz. o dosya),
// ama admin panele girer girmez "hangi videoyu kime atamalıyım" sorusuna
// cevap vermiyordu. Bu fonksiyon soruyu TERSİNE çeviriyor: kurumun TÜM
// kırmızı bölge satırlarını ve TÜM Matematik/Fizik videolarını TEK seferde
// çekip (video kartı başına ayrı sorgu YOK — N+1'den bilerek kaçınıldı),
// hangi videonun kaç "zayıf ve henüz atanmamış" öğrenciyle eşleştiğini
// hesaplayıp en çok öğrenciyi ilgilendiren videoları sıralar. Video panel
// açılışında BİR KEZ çağrılıyor, sonucu client tarafında zaten yüklü olan
// `videos` state'iyle birleştirip kart olarak gösteriyor (bkz.
// video-portal-panel.tsx).
export async function getVideoRecommendationsOverview(institutionId: string, limit = 8): Promise<VideoRecommendationOverviewItem[]> {
  const videos = await prisma.video.findMany({
    where: { institutionId, status: "READY", subject: { in: [...XRAY_VIDEO_SUBJECTS] } },
    select: { id: true, subject: true, topic: true },
  });
  if (videos.length === 0) return [];

  const [redZoneRows, institutionStudents, assignments] = await Promise.all([
    prisma.topicMasteryAssessment.findMany({
      where: { subject: { in: [...XRAY_VIDEO_SUBJECTS] }, masteryScore: { lt: RED_ZONE_THRESHOLD } },
      select: { studentId: true, subject: true, subtopicId: true, masteryScore: true },
    }),
    prisma.student.findMany({ where: { institutionId, isActive: true }, select: { id: true } }),
    prisma.videoAssignment.findMany({ where: { videoId: { in: videos.map((v) => v.id) } }, select: { videoId: true, studentId: true } }),
  ]);

  const institutionStudentIds = new Set(institutionStudents.map((s) => s.id));
  const scopedRedZone = redZoneRows.filter((r) => institutionStudentIds.has(r.studentId));

  const assignedByVideo = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!assignedByVideo.has(a.videoId)) assignedByVideo.set(a.videoId, new Set());
    assignedByVideo.get(a.videoId)!.add(a.studentId);
  }

  type Candidate = { videoId: string; worstByStudent: Map<string, { subtopicId: string; masteryScore: number }>; nameBySubtopicId: Map<string, string> };
  const candidates: Candidate[] = [];

  for (const video of videos) {
    const matched = matchSubtopicsForVideoTopic(video.subject, video.topic);
    if (matched.length === 0) continue;
    const matchedIds = new Set(matched.map((m) => m.subtopicId));
    const nameBySubtopicId = new Map(matched.map((m) => [m.subtopicId, m.name]));
    const assigned = assignedByVideo.get(video.id) ?? new Set<string>();

    const worstByStudent = new Map<string, { subtopicId: string; masteryScore: number }>();
    for (const row of scopedRedZone) {
      if (row.subject !== video.subject || !matchedIds.has(row.subtopicId) || assigned.has(row.studentId)) continue;
      const current = worstByStudent.get(row.studentId);
      if (!current || row.masteryScore < current.masteryScore) worstByStudent.set(row.studentId, row);
    }
    if (worstByStudent.size === 0) continue;
    candidates.push({ videoId: video.id, worstByStudent, nameBySubtopicId });
  }

  const ranked = candidates.sort((a, b) => b.worstByStudent.size - a.worstByStudent.size).slice(0, limit);

  // Örnek isimler için TEK toplu sorgu (her aday için en fazla 3 öğrenci id'si).
  const sampleIdsByVideo = new Map<string, string[]>();
  const allSampleIds = new Set<string>();
  for (const c of ranked) {
    const ids = [...c.worstByStudent.entries()].sort((a, b) => a[1].masteryScore - b[1].masteryScore).slice(0, 3).map(([id]) => id);
    sampleIdsByVideo.set(c.videoId, ids);
    for (const id of ids) allSampleIds.add(id);
  }
  const sampleStudents = await prisma.student.findMany({ where: { id: { in: [...allSampleIds] } }, select: { id: true, firstName: true } });
  const firstNameById = new Map(sampleStudents.map((s) => [s.id, s.firstName]));

  return ranked.map((c) => {
    const subtopicCounts = new Map<string, number>();
    for (const { subtopicId } of c.worstByStudent.values()) subtopicCounts.set(subtopicId, (subtopicCounts.get(subtopicId) ?? 0) + 1);
    const topSubtopicId = [...subtopicCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      videoId: c.videoId,
      studentCount: c.worstByStudent.size,
      topSubtopicName: c.nameBySubtopicId.get(topSubtopicId) ?? "",
      sampleNames: (sampleIdsByVideo.get(c.videoId) ?? []).map((id) => firstNameById.get(id) ?? "").filter(Boolean),
    };
  });
}
