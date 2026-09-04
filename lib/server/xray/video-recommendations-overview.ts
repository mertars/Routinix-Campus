import { prisma } from "@/lib/server/prisma";
import { matchSubtopicsForVideoTopic } from "./video-topic-match";

const RED_ZONE_THRESHOLD = 30;
const XRAY_VIDEO_SUBJECTS = ["Matematik", "Fizik"] as const;

// Kullanıcı talebi (2026-09-04) — "ata dendiğinde hangi video gidiyor
// görmüyor, bunu görmeli": önceki sürüm VİDEO bazlı sıralanmış bir özet
// döndürüyordu ("bu videoyu 10 öğrenci bekliyor"), ama tek bir öğrenciye
// tıklandığında HANGİ videonun gideceği belirsizdi. Bu fonksiyon artık
// doğrudan ÖĞRENCİ↔VİDEO eşleşmiş çiftler döndürüyor — her satır tek bir
// öğrenci + tek bir (o öğrencinin EN ZAYIF, kütüphanede karşılığı olan
// konusuna karşılık gelen) video, tek tıkla belirsizlik olmadan atanabilir.
export type VideoRecommendationPair = {
  studentId: string;
  studentName: string;
  branchName: string;
  grade: number;
  subtopicName: string;
  masteryScore: number;
  videoId: string;
  videoTitle: string;
  videoSubject: string;
  videoTopic: string;
};

export async function getVideoRecommendationPairs(institutionId: string, limit = 20): Promise<VideoRecommendationPair[]> {
  const videos = await prisma.video.findMany({
    where: { institutionId, status: "READY", subject: { in: [...XRAY_VIDEO_SUBJECTS] } },
    select: { id: true, title: true, subject: true, topic: true },
  });
  if (videos.length === 0) return [];

  // subtopicId -> bu konuyu kapsayan videolar (birden fazla video aynı alt
  // konuyu kapsayabilir — her biri aday, öğrenci başına İLKİ seçilir) +
  // subtopic adı (masteryScore'un yanında "hangi konudan" gerekçesi için).
  const videosBySubtopic = new Map<string, { videoId: string; videoTitle: string; videoSubject: string; videoTopic: string }[]>();
  const subtopicNameById = new Map<string, string>();
  for (const video of videos) {
    for (const m of matchSubtopicsForVideoTopic(video.subject, video.topic)) {
      subtopicNameById.set(m.subtopicId, m.name);
      const list = videosBySubtopic.get(m.subtopicId) ?? [];
      list.push({ videoId: video.id, videoTitle: video.title, videoSubject: video.subject, videoTopic: video.topic });
      videosBySubtopic.set(m.subtopicId, list);
    }
  }
  if (videosBySubtopic.size === 0) return [];

  const [redZoneRows, institutionStudents, assignments] = await Promise.all([
    prisma.topicMasteryAssessment.findMany({
      where: { subject: { in: [...XRAY_VIDEO_SUBJECTS] }, subtopicId: { in: [...videosBySubtopic.keys()] }, masteryScore: { lt: RED_ZONE_THRESHOLD } },
      select: { studentId: true, subtopicId: true, masteryScore: true },
    }),
    prisma.student.findMany({ where: { institutionId, isActive: true }, select: { id: true, firstName: true, lastName: true, branch: { select: { name: true, grade: true } } } }),
    prisma.videoAssignment.findMany({ where: { videoId: { in: videos.map((v) => v.id) } }, select: { videoId: true, studentId: true } }),
  ]);

  const studentById = new Map(institutionStudents.map((s) => [s.id, s]));
  const assignedPairKey = new Set(assignments.map((a) => `${a.studentId}:${a.videoId}`));

  type Candidate = VideoRecommendationPair;
  const bestByStudent = new Map<string, Candidate>();

  for (const row of redZoneRows) {
    const student = studentById.get(row.studentId);
    if (!student) continue; // farklı kurumdan / pasif öğrenci
    const candidates = videosBySubtopic.get(row.subtopicId) ?? [];
    const video = candidates.find((c) => !assignedPairKey.has(`${row.studentId}:${c.videoId}`));
    if (!video) continue; // bu konudaki tüm eşleşen videolar zaten atanmış

    const current = bestByStudent.get(row.studentId);
    if (current && current.masteryScore <= row.masteryScore) continue; // öğrencinin zaten daha acil bir önerisi var

    bestByStudent.set(row.studentId, {
      studentId: row.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      branchName: student.branch?.name ?? "",
      grade: student.branch?.grade ?? 0,
      subtopicName: subtopicNameById.get(row.subtopicId) ?? "",
      masteryScore: row.masteryScore,
      videoId: video.videoId,
      videoTitle: video.videoTitle,
      videoSubject: video.videoSubject,
      videoTopic: video.videoTopic,
    });
  }

  return [...bestByStudent.values()].sort((a, b) => a.masteryScore - b.masteryScore).slice(0, limit);
}
