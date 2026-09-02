import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { generateXrayRecommendations, summarizeXrayDiagnosis, type XrayRecommendation, type XraySummary } from "./recommendations";

// Faz Q — `/api/xray/my-roadmap` (öğrencinin KENDİ paneli) ile yeni
// `/api/xray/roadmap/[studentId]` (yönetici/öğretmen/veli ekranı) AYNI
// hesaplamayı yapıyordu — bu dosya o ORTAK mantığı TEK yere toplar, iki
// route sadece kendi yetki kontrolünü yapıp bu fonksiyonları çağırır.
export type SubjectRoadmap = { subject: string; summary: XraySummary; recommendations: XrayRecommendation[] };

function subtopicNameMap(subject: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const topic of CURRICULUM_TREE[subject] ?? []) {
    for (const sub of topic.subtopics) map.set(sub.id, sub.name);
  }
  return map;
}

function buildFromRows(subject: string, rows: { subtopicId: string; masteryScore: number }[]): SubjectRoadmap {
  const nameById = subtopicNameMap(subject);
  const diagnoses = rows.map((r) => ({ subtopicId: r.subtopicId, name: nameById.get(r.subtopicId) ?? r.subtopicId, masteryScore: r.masteryScore }));
  const recommendations = generateXrayRecommendations(diagnoses);
  const summary = summarizeXrayDiagnosis(recommendations);
  return { subject, summary, recommendations };
}

export async function buildRoadmapForAllSubjects(studentId: string): Promise<SubjectRoadmap[]> {
  const assessments = await prisma.topicMasteryAssessment.findMany({
    where: { studentId },
    select: { subject: true, subtopicId: true, masteryScore: true },
  });
  const bySubject = new Map<string, typeof assessments>();
  for (const row of assessments) {
    const list = bySubject.get(row.subject) ?? [];
    list.push(row);
    bySubject.set(row.subject, list);
  }
  return [...bySubject.entries()].map(([subject, rows]) => buildFromRows(subject, rows));
}

export async function buildRoadmapForSubject(studentId: string, subject: string): Promise<SubjectRoadmap> {
  const rows = await prisma.topicMasteryAssessment.findMany({
    where: { studentId, subject },
    select: { subtopicId: true, masteryScore: true },
  });
  return buildFromRows(subject, rows);
}
