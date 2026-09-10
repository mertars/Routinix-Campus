import { prisma } from "@/lib/server/prisma";
import { computeAttendanceRateFromCounts } from "@/lib/attendance/status";
import { toAttendanceDateKey } from "@/lib/attendance/date-key";
import { getStudentDebts } from "@/lib/server/payments/student-debt";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { paymentsHref } from "@/lib/agenda-types";
import { trPossessive } from "@/lib/tr-suffix";
import type { Student360, Student360Section } from "@/lib/student-360-types";

// ÖĞRENCİ 360 — beş modülün bir öğrenci hakkında bildiklerini tek yerde
// toplar.
//
// ⚠️ İKİ GİZLİLİK KURALI, ikisi de bilerek:
//
// 1. FİNANS ÖĞRETMENE KAPALI. Ödeme Takip modülünün kendisi öğretmene
//    kapalı (bkz. hub'daki "yalnızca yönetici" mesajı); borcu 360
//    kartından sızdırmak o kararı anlamsızlaştırırdı.
// 2. REHBERLİK NOTUNUN METNİ HİÇ DÖNMEZ. Notların gizlilik seviyesi var
//    (GuidanceNote.confidentialityLevel) ve bu kart kurum genelinde
//    açılıyor. Yalnızca "en son ne zaman not girilmiş" ve "kaç
//    yönlendirme bekliyor" bilgisi taşınır — içerik için rehberlik
//    ekranına gidilir.
//
// ⚠️ Sorguların hepsi TEK Promise.all'da koşar ve sınırlıdır; bu kart
// listeden tıklanınca açılıyor, bekletemez.

const RECENT_ABSENCE_DAYS = 30;
/** Deneme geçmişinden çekilecek en fazla net satırı — son ~15 denemeye yeter. */
const NET_ROW_LIMIT = 120;
const WEAK_MASTERY_THRESHOLD = 50;

function subtopicName(subject: string, subtopicId: string): string {
  for (const topic of CURRICULUM_TREE[subject] ?? []) {
    for (const sub of topic.subtopics) if (sub.id === subtopicId) return sub.name;
  }
  return subtopicId;
}

function formatTRY(n: number): string {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

export type Student360Options = {
  /** Öğretmen görünümünde false — bkz. yukarıdaki 1. kural. */
  includeFinance: boolean;
};

export async function getStudent360(studentId: string, options: Student360Options): Promise<Student360 | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      isActive: true,
      branch: { select: { name: true, grade: true } },
      advisorTeacher: { select: { firstName: true, lastName: true } },
      parents: {
        select: {
          parent: { select: { firstName: true, lastName: true, relationship: true, mobilePhone: true, smsConsent: true } },
        },
      },
    },
  });
  if (!student) return null;

  const since = toAttendanceDateKey(new Date(Date.now() - RECENT_ABSENCE_DAYS * 86_400_000));

  const [attendanceCounts, recentAbsences, netRows, mastery, debts, homework, lastNote, pendingReferrals, videos] =
    await Promise.all([
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { studentId },
        _count: { _all: true },
      }),

      prisma.attendanceRecord.count({ where: { studentId, status: "ABSENT", date: { gte: since } } }),

      // Sıralama ilişki üzerinden yapılır; sınav nesnesinin kendisi de
      // gerekiyor (adı ve tarihi başlıkta yazıyor).
      prisma.examNetResult.findMany({
        where: { studentId },
        select: { examId: true, net: true, exam: { select: { name: true, examDate: true } } },
        orderBy: { exam: { examDate: "desc" } },
        take: NET_ROW_LIMIT,
      }),

      // (studentId, subtopicId) benzersiz — her satır GÜNCEL durumdur,
      // geçmiş ayrı tabloda (TopicMasteryHistory). Ayıklama gerekmez.
      prisma.topicMasteryAssessment.findMany({
        where: { studentId },
        select: { subject: true, subtopicId: true, masteryScore: true },
      }),

      options.includeFinance ? getStudentDebts([studentId]) : Promise.resolve(null),

      prisma.homeworkSubmission.groupBy({ by: ["status"], where: { studentId }, _count: { _all: true } }),

      // ⚠️ Yalnızca TARİH — not metni bilerek çekilmiyor.
      prisma.guidanceNote.findFirst({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),

      prisma.guidanceReferral.count({ where: { studentId, status: "PENDING" } }),

      prisma.videoAssignment.findMany({ where: { studentId }, select: { watchedAt: true } }),
    ]);

  const sections: Student360Section[] = [];

  // ---- YOKLAMA (ERP) ----
  const counts = Object.fromEntries(attendanceCounts.map((c) => [c.status, c._count._all]));
  const totalRecords = attendanceCounts.reduce((s, c) => s + c._count._all, 0);
  const rate = computeAttendanceRateFromCounts(counts);
  sections.push({
    id: "attendance",
    module: "erp",
    label: "Yoklama",
    headline: totalRecords > 0 ? `%${rate}` : null,
    detail: totalRecords > 0 ? `${totalRecords} ders kaydı üzerinden devam oranı` : "Henüz yoklama kaydı yok",
    tone: totalRecords === 0 ? "neutral" : rate >= 90 ? "good" : rate >= 80 ? "warn" : "bad",
    bullets:
      totalRecords > 0
        ? [
            `Son ${RECENT_ABSENCE_DAYS} günde ${recentAbsences} devamsızlık`,
            counts.EXCUSED ? `${counts.EXCUSED} izinli (orana katılmaz)` : "",
            counts.LATE ? `${counts.LATE} geç geliş` : "",
          ].filter(Boolean)
        : [],
    tab: "attendance",
  });

  // ---- DENEME (Ölçme Değerlendirme) ----
  const byExam = new Map<string, { name: string; date: Date; net: number }>();
  for (const row of netRows) {
    const entry = byExam.get(row.examId);
    if (entry) entry.net += row.net;
    else byExam.set(row.examId, { name: row.exam.name, date: row.exam.examDate, net: row.net });
  }
  const exams = [...byExam.values()];
  const latest = exams[0];
  const previous = exams[1];
  const delta = latest && previous ? Math.round((latest.net - previous.net) * 10) / 10 : null;
  sections.push({
    id: "exams",
    module: "olcme",
    label: "Deneme",
    headline: latest ? `${Math.round(latest.net * 10) / 10} net` : null,
    detail: latest ? `${latest.name} · ${formatDate(latest.date)}` : "Henüz deneme sonucu girilmemiş",
    tone: !latest ? "neutral" : delta === null ? "neutral" : delta > 0 ? "good" : delta < 0 ? "warn" : "neutral",
    bullets: latest
      ? [
          delta !== null ? `Önceki denemeye göre ${delta > 0 ? "+" : ""}${delta} net` : "İlk deneme",
          `${exams.length} denemesi işlendi`,
        ]
      : [],
    href: "/olcme/principal",
  });

  // ---- AKADEMİK RÖNTGEN ----
  const weakest = [...mastery].sort((a, b) => a.masteryScore - b.masteryScore).slice(0, 3);
  const avgMastery = mastery.length > 0 ? Math.round(mastery.reduce((s, m) => s + m.masteryScore, 0) / mastery.length) : null;
  const weakCount = mastery.filter((m) => m.masteryScore < WEAK_MASTERY_THRESHOLD).length;
  sections.push({
    id: "xray",
    module: "xray",
    label: "Akademik Röntgen",
    headline: avgMastery !== null ? `%${avgMastery}` : null,
    detail:
      avgMastery !== null
        ? `${mastery.length} kazanımda ortalama hâkimiyet · ${weakCount} zayıf`
        : "Henüz kazanım ölçümü yok",
    tone: avgMastery === null ? "neutral" : avgMastery >= 70 ? "good" : avgMastery >= 50 ? "warn" : "bad",
    bullets: weakest.map((m) => `${subtopicName(m.subject, m.subtopicId)} · %${m.masteryScore}`),
    href: "/xray/principal",
  });

  // ---- ÖDEME (yalnızca yönetici) ----
  if (debts) {
    const debt = debts.get(studentId);
    const open = debt?.openDebt ?? 0;
    const overdue = debt?.overdueDebt ?? 0;
    sections.push({
      id: "payments",
      module: "payments",
      label: "Ödeme",
      headline: open > 0 ? formatTRY(open) : "Borç yok",
      detail: open > 0 ? "Açık bakiye" : "Tüm taksitler kapalı",
      tone: overdue > 0 ? "bad" : open > 0 ? "warn" : "good",
      bullets: [
        overdue > 0 ? `${formatTRY(overdue)} vadesi geçmiş` : "",
        debt?.nextDueDate ? `Sıradaki taksit ${formatDate(new Date(debt.nextDueDate))}${debt.nextDueAmount ? ` · ${formatTRY(debt.nextDueAmount)}` : ""}` : "",
      ].filter(Boolean),
      href: paymentsHref("students"),
    });
  }

  // ---- ÖDEV (ERP) ----
  const hwCounts = Object.fromEntries(homework.map((h) => [h.status, h._count._all]));
  const hwTotal = homework.reduce((s, h) => s + h._count._all, 0);
  const hwDone = (hwCounts.DONE ?? 0) + (hwCounts.LATE ?? 0);
  const hwRate = hwTotal > 0 ? Math.round((hwDone / hwTotal) * 100) : null;
  sections.push({
    id: "homework",
    module: "erp",
    label: "Ödev",
    headline: hwRate !== null ? `%${hwRate}` : null,
    detail: hwTotal > 0 ? `${hwTotal} ödevin ${trPossessive(hwDone)} teslim edildi` : "Henüz ödev atanmamış",
    tone: hwRate === null ? "neutral" : hwRate >= 80 ? "good" : hwRate >= 60 ? "warn" : "bad",
    bullets: [
      hwCounts.NOT_DONE ? `${hwCounts.NOT_DONE} ödev hiç yapılmadı` : "",
      hwCounts.LATE ? `${hwCounts.LATE} geç teslim` : "",
    ].filter(Boolean),
    tab: "students",
  });

  // ---- REHBERLİK (ERP) — içerik YOK, yalnızca durum ----
  sections.push({
    id: "guidance",
    module: "erp",
    label: "Rehberlik",
    headline: pendingReferrals > 0 ? `${pendingReferrals} yönlendirme` : lastNote ? "Takipte" : null,
    detail: lastNote ? `Son not ${formatDate(lastNote.createdAt)}` : "Henüz rehberlik notu yok",
    tone: pendingReferrals > 0 ? "warn" : lastNote ? "neutral" : "neutral",
    bullets: pendingReferrals > 0 ? ["Öğretmen yönlendirmesi incelenmeyi bekliyor"] : [],
    tab: "guidance-program",
  });

  // ---- VİDEO ----
  const watched = videos.filter((v) => v.watchedAt !== null).length;
  sections.push({
    id: "video",
    module: "video",
    label: "Video",
    headline: videos.length > 0 ? `${watched}/${videos.length}` : null,
    detail: videos.length > 0 ? "Atanan videoların izlenme durumu" : "Henüz video atanmamış",
    tone: videos.length === 0 ? "neutral" : watched === videos.length ? "good" : watched === 0 ? "warn" : "neutral",
    bullets: videos.length > 0 && watched < videos.length ? [`${videos.length - watched} video henüz izlenmedi`] : [],
    href: "/videos/principal",
  });

  return {
    student: {
      id: student.id,
      fullName: `${student.firstName} ${student.lastName}`,
      studentNumber: student.studentNumber,
      branchName: student.branch.name,
      grade: student.branch.grade,
      isActive: student.isActive,
      advisorName: student.advisorTeacher
        ? `${student.advisorTeacher.firstName} ${student.advisorTeacher.lastName}`
        : null,
    },
    parents: student.parents.map((p) => ({
      name: `${p.parent.firstName} ${p.parent.lastName}`,
      relationship: p.parent.relationship,
      phone: p.parent.mobilePhone,
      smsConsent: p.parent.smsConsent,
    })),
    sections,
    financeHidden: !options.includeFinance,
  };
}
