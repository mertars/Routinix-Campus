import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { maybeCreateAutoReferral } from "@/lib/server/xray/auto-referral";

export type SubtopicBreakdownRow = {
  subtopicId: string | null;
  subtopicLabel: string;
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  percent: number;
};

// Ölçme Değerlendirme — "kazanım bazlı deneme analizi" (2026-09-05). Bir
// sınavın BİR öğrenci + BİR dersteki cevap anahtarını (ExamQuestion) ve
// yanlış/boş soru numaralarını (ExamNetResult) birleştirip konu bazlı
// doğru/yanlış/boş kırılımı üretir. Cevap anahtarı hiç tanımlanmamışsa
// (o ders için ExamQuestion satırı yoksa) boş dizi döner — bu NORMAL bir
// durum, her sınav/ders için kazanım eşlemesi zorunlu değil.
export async function computeExamSubtopicBreakdown(examId: string, studentId: string, subject: string): Promise<SubtopicBreakdownRow[]> {
  const [questions, result] = await Promise.all([
    prisma.examQuestion.findMany({ where: { examId, subject }, select: { questionNumber: true, subtopicId: true, subtopicLabel: true } }),
    prisma.examNetResult.findUnique({
      where: { examId_studentId_subject: { examId, studentId, subject } },
      select: { wrongQuestionNumbers: true, blankQuestionNumbers: true },
    }),
  ]);
  if (questions.length === 0) return [];

  const wrongSet = new Set(result?.wrongQuestionNumbers ?? []);
  const blankSet = new Set(result?.blankQuestionNumbers ?? []);

  const bySubtopic = new Map<string, { subtopicId: string | null; subtopicLabel: string; total: number; wrong: number; blank: number }>();
  for (const q of questions) {
    const key = q.subtopicId ?? `label:${q.subtopicLabel}`;
    const entry = bySubtopic.get(key) ?? { subtopicId: q.subtopicId, subtopicLabel: q.subtopicLabel, total: 0, wrong: 0, blank: 0 };
    entry.total += 1;
    if (wrongSet.has(q.questionNumber)) entry.wrong += 1;
    else if (blankSet.has(q.questionNumber)) entry.blank += 1;
    bySubtopic.set(key, entry);
  }

  return [...bySubtopic.values()]
    .map((e) => {
      const correct = Math.max(0, e.total - e.wrong - e.blank);
      return {
        subtopicId: e.subtopicId,
        subtopicLabel: e.subtopicLabel,
        total: e.total,
        correct,
        wrong: e.wrong,
        blank: e.blank,
        percent: Math.round((correct / e.total) * 100),
      };
    })
    .sort((a, b) => a.percent - b.percent);
}

export type ClassSubtopicSummaryRow = { subtopicId: string | null; subtopicLabel: string; averagePercent: number; studentCount: number };

// Ölçme Değerlendirme modülü — sınıf/kurum geneli "en zayıf kazanımlar"
// özeti (bkz. components/olcme/olcme-panel.tsx). Sadece kazanım verisi
// GİRİLMİŞ öğrencileri sayar — wrongQuestionNumbers/blankQuestionNumbers
// ikisi de boşsa "henüz girilmemiş" kabul edilir (nadir bir kenar durum:
// bir öğrenci GERÇEKTEN hepsini doğru yaptıysa da aynı şekilde görünür,
// bu sadece özet gösterimini etkiler — Röntgen'e yazma mantığı bundan
// BAĞIMSIZ, her öğrenci ayrı ayrı computeExamSubtopicBreakdown ile işlenir).
export async function computeExamClassSubtopicSummary(examId: string, subject: string): Promise<ClassSubtopicSummaryRow[]> {
  const [questions, results] = await Promise.all([
    prisma.examQuestion.findMany({ where: { examId, subject }, select: { questionNumber: true, subtopicId: true, subtopicLabel: true } }),
    prisma.examNetResult.findMany({ where: { examId, subject }, select: { wrongQuestionNumbers: true, blankQuestionNumbers: true } }),
  ]);
  if (questions.length === 0) return [];
  const entered = results.filter((r) => r.wrongQuestionNumbers.length > 0 || r.blankQuestionNumbers.length > 0);
  if (entered.length === 0) return [];

  const groups = new Map<string, { subtopicId: string | null; subtopicLabel: string; questionNumbers: number[] }>();
  for (const q of questions) {
    const key = q.subtopicId ?? `label:${q.subtopicLabel}`;
    const g = groups.get(key) ?? { subtopicId: q.subtopicId, subtopicLabel: q.subtopicLabel, questionNumbers: [] };
    g.questionNumbers.push(q.questionNumber);
    groups.set(key, g);
  }

  return [...groups.values()]
    .map((g) => {
      let sumPercent = 0;
      for (const r of entered) {
        const wrongSet = new Set(r.wrongQuestionNumbers);
        const blankSet = new Set(r.blankQuestionNumbers);
        const wrong = g.questionNumbers.filter((n) => wrongSet.has(n)).length;
        const blank = g.questionNumbers.filter((n) => blankSet.has(n)).length;
        const correct = Math.max(0, g.questionNumbers.length - wrong - blank);
        sumPercent += (correct / g.questionNumbers.length) * 100;
      }
      return {
        subtopicId: g.subtopicId,
        subtopicLabel: g.subtopicLabel,
        averagePercent: Math.round(sumPercent / entered.length),
        studentCount: entered.length,
      };
    })
    .sort((a, b) => a.averagePercent - b.averagePercent);
}

// Röntgen köprüsü — kullanıcı talebi: "hepsi birbirini besleyen modüller
// zinciri olacak". Gerçek bir kağıt denemenin kazanım kırılımını
// TopicMasteryAssessment'a (source=PAPER_EXAM) yazar — bundan sonra hem
// Akademik Röntgen ekranları HEM Video Ders Merkezi'nin "Röntgen
// Önerileri" motoru (video-recommendations-overview.ts) bu veriyi
// SIFIR EK KOD ile otomatik yakalar, çünkü ikisi de zaten aynı tabloyu
// okuyor. SADECE CURRICULUM_TREE'de gerçek alt konu kırılımı olan
// derslerde (bugün: Matematik, Fizik) çalışır — TopicMasteryAssessment.
// subtopicId her zaman GERÇEK bir CURRICULUM_TREE subtopic.id'si olmalı
// (bkz. o modelin üstündeki not), başka derslerde yazacak geçerli bir
// hedef yok. Diğer derslerin kırılımı yine hesaplanır ve karnede/analiz
// ekranında gösterilir, sadece Röntgen'e YAZILMAZ.
export async function syncExamResultToRoentgen(examId: string, studentId: string, subject: string): Promise<void> {
  if (!(subject in CURRICULUM_TREE)) return;

  const breakdown = await computeExamSubtopicBreakdown(examId, studentId, subject);
  const withSubtopic = breakdown.filter((row): row is SubtopicBreakdownRow & { subtopicId: string } => row.subtopicId !== null);
  if (withSubtopic.length === 0) return;

  await Promise.all(
    withSubtopic.map((row) =>
      prisma.topicMasteryAssessment.upsert({
        where: { studentId_subtopicId: { studentId, subtopicId: row.subtopicId } },
        create: { studentId, subject, subtopicId: row.subtopicId, masteryScore: row.percent, source: "PAPER_EXAM" },
        update: { subject, masteryScore: row.percent, source: "PAPER_EXAM", sourceSessionId: null, assessedAt: new Date() },
      })
    )
  );
  await prisma.topicMasteryHistory.createMany({
    data: withSubtopic.map((row) => ({ studentId, subject, subtopicId: row.subtopicId, masteryScore: row.percent, source: "PAPER_EXAM" as const })),
  });

  // Diğer TÜM yazma noktalarıyla (comprehension-assignment/complete) AYNI
  // otomatik rehberlik sevki — gerçek bir deneme sonucu da danışman
  // öğretmene aynı şekilde bildirim düşürsün.
  for (const row of withSubtopic) {
    await maybeCreateAutoReferral(studentId, subject, row.subtopicLabel, row.percent);
  }
}
