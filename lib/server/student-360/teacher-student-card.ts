import { prisma } from "@/lib/server/prisma";
import { computeAttendanceRateFromCounts } from "@/lib/attendance/status";
import { CURRICULUM_TREE } from "@/lib/mock-data";

// ÖĞRETMENE ÖZEL ÖĞRENCİ KARTI.
//
// ⚠️ Öğrenci 360'tan (lib/server/student-360/student-360.ts) BİLEREK AYRI.
// O kart kurum geneli bir yönetici görüşüdür: finans, tüm dersler, tüm
// denemeler. Kullanıcı kararı (2026-09-15): *"öğretmen için özelleşmiş bir
// kart olmalı, ödeme filan değil — kendi dersi için netleri nasıl, röntgen
// başarısı nasıl, kazanım kazanım, kendi dersinde devamsızlığı nasıl, kaç
// ödevi yapmış neyi yapmamış."*
//
// Bu yüzden buradaki HER bölüm ÖĞRETMENİN KENDİ DERSİYLE sınırlıdır:
//   * devamsızlık → yalnızca o dersin yoklama kayıtları (AttendanceRecord.subject)
//   * netler      → yalnızca o dersin net sonuçları (ExamNetResult.subject)
//   * kazanımlar  → yalnızca o dersin konu hakimiyeti (TopicMasteryAssessment.subject)
//   * ödevler     → yalnızca O ÖĞRETMENİN verdiği ödevler (Homework.teacherId)
//   * quiz/soru   → yalnızca o öğretmenin açtıkları
//
// ⚠️ FİNANS BİLGİSİ HİÇ HESAPLANMAZ — Öğrenci 360'taki aynı gizlilik
// çizgisi: öğretmene borç/ödeme verisi dönmez.

export type TeacherStudentCard = {
  student: { id: string; name: string; branchName: string; studentNumber: string };
  subject: string;
  attendance: {
    rate: number | null;
    present: number;
    absent: number;
    late: number;
    excused: number;
    recentAbsences: { date: string; slot: string }[];
  };
  nets: {
    exams: { examName: string; date: string; net: number }[];
    latest: number | null;
    delta: number | null;
    best: number | null;
  };
  mastery: {
    average: number | null;
    /** Kazanım kazanım — en zayıftan güçlüye. */
    topics: { subtopicId: string; name: string; score: number; assessedAt: string }[];
    weakCount: number;
  };
  homework: {
    total: number;
    done: number;
    half: number;
    late: number;
    notDone: number;
    /** Yapılmayanlar ayrı listelenir — öğretmenin ilk sorduğu bu. */
    missing: { title: string; dueAt: string | null }[];
  };
  engagement: {
    quizCount: number;
    quizAccuracy: number | null;
    questionsAsked: number;
    questionsPending: number;
  };
};

/** subtopicId → okunabilir ad (CURRICULUM_TREE'den). */
function subtopicNameMap(subject: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const topic of CURRICULUM_TREE[subject] ?? []) {
    for (const sub of topic.subtopics) map.set(sub.id, sub.name);
  }
  return map;
}

export async function getTeacherStudentCard(
  teacherId: string,
  studentId: string
): Promise<TeacherStudentCard | null> {
  const [teacher, student] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { subject: true } }),
    prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true, studentNumber: true, branch: { select: { name: true } } },
    }),
  ]);
  if (!teacher || !student) return null;
  const subject = teacher.subject;

  const since = new Date();
  since.setMonth(since.getMonth() - 3);

  // ⚠️ Hepsi BİRBİRİNDEN BAĞIMSIZ — tek Promise.all. Ardışık yazılırsa her
  // sorgu tam bir ağ turu ekler (bkz. agenda kaynaklarındaki aynı not).
  const [attendanceCounts, recentAbsences, netRows, masteryRows, homeworkRows, quizRows, questionCounts] =
    await Promise.all([
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { studentId, subject },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.findMany({
        where: { studentId, subject, status: "ABSENT" },
        select: { date: true, slot: true },
        orderBy: { date: "desc" },
        take: 5,
      }),
      prisma.examNetResult.findMany({
        where: { studentId, subject },
        select: { net: true, exam: { select: { name: true, examDate: true } } },
        orderBy: { exam: { examDate: "desc" } },
        take: 10,
      }),
      prisma.topicMasteryAssessment.findMany({
        where: { studentId, subject },
        select: { subtopicId: true, masteryScore: true, assessedAt: true },
        orderBy: { assessedAt: "desc" },
      }),
      // Bu öğretmenin verdiği ödevler + bu öğrencinin durumu.
      prisma.homework.findMany({
        where: { teacherId },
        select: {
          title: true,
          dueAt: true,
          submissions: { where: { studentId }, select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.quizSubmission.findMany({
        where: { studentId, quiz: { teacherId } },
        select: { correct: true, wrong: true },
      }),
      prisma.question.groupBy({
        by: ["status"],
        where: { studentId, teacherId },
        _count: { _all: true },
      }),
    ]);

  // --- Devamsızlık (yalnız bu ders) ---
  const counts: Record<string, number> = {};
  for (const c of attendanceCounts) counts[c.status] = c._count._all;
  const totalAttendance = Object.values(counts).reduce((s, n) => s + n, 0);

  // --- Netler (yalnız bu ders) ---
  const exams = netRows.map((r) => ({
    examName: r.exam.name,
    date: r.exam.examDate.toISOString(),
    net: r.net,
  }));
  const latest = exams[0]?.net ?? null;
  const previous = exams[1]?.net ?? null;

  // --- Kazanımlar: her konunun EN SON ölçümü (tarih sırası desc geldiği
  // için ilk görülen en günceli). Eski ölçümler ortalamayı bozmasın.
  const names = subtopicNameMap(subject);
  const latestByTopic = new Map<string, { score: number; assessedAt: Date }>();
  for (const row of masteryRows) {
    if (!latestByTopic.has(row.subtopicId)) {
      latestByTopic.set(row.subtopicId, { score: row.masteryScore, assessedAt: row.assessedAt });
    }
  }
  const topics = [...latestByTopic.entries()]
    .map(([subtopicId, v]) => ({
      subtopicId,
      name: names.get(subtopicId) ?? subtopicId,
      score: v.score,
      assessedAt: v.assessedAt.toISOString(),
    }))
    .sort((a, b) => a.score - b.score); // en zayıf önce — öğretmenin işi orada

  const masteryAvg = topics.length
    ? Math.round(topics.reduce((s, t) => s + t.score, 0) / topics.length)
    : null;

  // --- Ödevler (yalnız bu öğretmenin verdikleri) ---
  const hwCounts = { DONE: 0, HALF: 0, LATE: 0, NOT_DONE: 0 } as Record<string, number>;
  const missing: { title: string; dueAt: string | null }[] = [];
  for (const hw of homeworkRows) {
    // Kaydı olmayan = henüz yapılmamış (matristeki varsayılanla aynı).
    const status = hw.submissions[0]?.status ?? "NOT_DONE";
    hwCounts[status] = (hwCounts[status] ?? 0) + 1;
    if (status === "NOT_DONE") missing.push({ title: hw.title, dueAt: hw.dueAt?.toISOString() ?? null });
  }

  // --- Katılım ---
  const quizTotal = quizRows.reduce((s, q) => s + q.correct + q.wrong, 0);
  const quizCorrect = quizRows.reduce((s, q) => s + q.correct, 0);
  const qCounts: Record<string, number> = {};
  for (const q of questionCounts) qCounts[q.status] = q._count._all;

  return {
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      branchName: student.branch?.name ?? "—",
      studentNumber: student.studentNumber,
    },
    subject,
    attendance: {
      rate: totalAttendance > 0 ? computeAttendanceRateFromCounts(counts) : null,
      present: counts.PRESENT ?? 0,
      absent: counts.ABSENT ?? 0,
      late: counts.LATE ?? 0,
      excused: counts.EXCUSED ?? 0,
      recentAbsences: recentAbsences.map((a) => ({ date: a.date.toISOString(), slot: a.slot })),
    },
    nets: {
      exams,
      latest,
      delta: latest !== null && previous !== null ? Number((latest - previous).toFixed(2)) : null,
      best: exams.length ? Math.max(...exams.map((e) => e.net)) : null,
    },
    mastery: {
      average: masteryAvg,
      topics,
      weakCount: topics.filter((t) => t.score < 50).length,
    },
    homework: {
      total: homeworkRows.length,
      done: hwCounts.DONE ?? 0,
      half: hwCounts.HALF ?? 0,
      late: hwCounts.LATE ?? 0,
      notDone: hwCounts.NOT_DONE ?? 0,
      missing: missing.slice(0, 8),
    },
    engagement: {
      quizCount: quizRows.length,
      quizAccuracy: quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : null,
      questionsAsked: Object.values(qCounts).reduce((s, n) => s + n, 0),
      questionsPending: qCounts.PENDING ?? 0,
    },
  };
}
