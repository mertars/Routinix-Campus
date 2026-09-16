import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { computeAttendanceRateFromCounts } from "@/lib/attendance/status";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { getTrDayNameForDate } from "@/lib/schedule-time";

export const dynamic = "force-dynamic";

// AKADEMİK DURUM — tek öğrencinin TÜM sonuçları, tek uçta.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): "akademik durum tuşuna basıldığında tam
// ekran bir tasarım yap; öğrencinin ödevlerini, röntgenini, yoklamasını
// vs. hepsini içeren bütün sonuçları gördüğü şık bir ekran olsun — yani
// Öğrenci 360'tan FARKLI bir panel". Öğrenci 360 bilerek ÖZETtir (her
// modülden tek sayı + o modüle giden bir kapı); rehber öğretmen ise
// görüşmeye girerken SATIR SATIR sonuç görmek istiyor: hangi ödev
// yapılmadı, hangi kazanımda kaç puan, hangi güne devamsızlık yazıldı.
//
// ⚠️ Rehberliğin röntgen modülüne (/xray/principal) girişi YOK (bkz.
// middleware.ts > ROUTE_ROLE) ve bu bilerek böyle: o panel kurum geneli
// atama/ayar ekranıdır. Bu yüzden röntgen SONUÇLARI buraya, öğrenci
// bazında ve salt-okunur olarak taşınıyor — yetki genişletmeden aynı
// ihtiyaç karşılanıyor.
//
// ⚠️ FİNANS YOK — dosya ucundaki (dossier/route.ts) aynı kural: borç
// rehberlik görüşmesinin konusu değil.

const RECENT_ATTENDANCE_LIMIT = 40;
const WEAK_MASTERY_THRESHOLD = 50;

function subtopicName(subject: string, subtopicId: string): string {
  for (const topic of CURRICULUM_TREE[subject] ?? []) {
    for (const sub of topic.subtopics) if (sub.id === subtopicId) return sub.name;
  }
  return subtopicId;
}

async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "guidance", "principal");

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNumber: true,
        institutionId: true,
        branchId: true,
        branch: { select: { name: true, grade: true, track: true } },
        advisorTeacher: { select: { firstName: true, lastName: true } },
      },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    // ⚠️ Yedi sorgu birbirinden bağımsız — ardışık atılsalardı tam ekran
    // panel yedi ağ turu beklerdi (bkz. dossier/route.ts'teki aynı gerekçe).
    const [
      attendanceCounts,
      allAttendance,
      recentAttendance,
      submissions,
      mastery,
      xrayAssignments,
      netRows,
      videoAssignments,
      lessonSlots,
      programs,
    ] = await Promise.all([
      prisma.attendanceRecord.groupBy({ by: ["status"], where: { studentId: student.id }, _count: { _all: true } }),
      // Ders bazlı tablo TÜM kayıtları gerektirir (son 40 değil) — ama
      // yalnızca üç küçük alan çekilir.
      prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
        select: { date: true, status: true, subject: true },
      }),
      prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
        select: { id: true, date: true, slot: true, subject: true, status: true },
        orderBy: { date: "desc" },
        take: RECENT_ATTENDANCE_LIMIT,
      }),
      prisma.homeworkSubmission.findMany({
        where: { studentId: student.id },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          homework: {
            select: {
              title: true,
              dueAt: true,
              targetQuestionCount: true,
              teacher: { select: { firstName: true, lastName: true, subject: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      prisma.topicMasteryAssessment.findMany({
        where: { studentId: student.id },
        select: { id: true, subject: true, subtopicId: true, masteryScore: true, assessedAt: true, source: true },
        orderBy: { masteryScore: "asc" },
      }),
      prisma.xrayComprehensionAssignment.findMany({
        where: { studentId: student.id },
        select: {
          id: true,
          subject: true,
          subtopicId: true,
          status: true,
          assignedAt: true,
          completedAt: true,
          flagReason: true,
          answers: { select: { selectedOption: { select: { isCorrect: true } } } },
        },
        orderBy: { assignedAt: "desc" },
        take: 30,
      }),
      prisma.examNetResult.findMany({
        where: { studentId: student.id },
        select: { id: true, subject: true, net: true, exam: { select: { name: true, examDate: true } } },
        orderBy: { id: "desc" },
        take: 200,
      }),
      prisma.videoAssignment.findMany({
        where: { studentId: student.id },
        select: {
          id: true,
          assignedAt: true,
          watchedAt: true,
          watchedSeconds: true,
          video: { select: { title: true, subject: true, durationSeconds: true } },
        },
        orderBy: { assignedAt: "desc" },
        take: 30,
      }),
      // ⚠️ DERS BAZLI DEVAMSIZLIK için şubenin haftalık programı (Mert,
      // 2026-09-16: "hangi derse kaç kere gelmediği yazsın"). Kayıtların
      // çoğu GÜN GENELİ (subject="Genel", slot="") — o günün hangi
      // derslerine denk geldiği ancak ders programından çıkar.
      prisma.lessonSlot.findMany({
        where: { branchId: student.branchId ?? "" },
        select: { day: true, slot: true, subject: true, teacher: { select: { firstName: true, lastName: true } } },
      }),
      prisma.guidanceProgram.findMany({
        where: { studentId: student.id },
        select: {
          id: true,
          weekLabel: true,
          createdAt: true,
          entries: { select: { id: true, kind: true, completedAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const row of attendanceCounts) counts[row.status] = row._count._all;

    // DERS BAZLI DEVAMSIZLIK TABLOSU.
    //
    // İki kaynak var ve ikisi de dürüstçe etiketlenir:
    //  • Kaydın kendi `subject` alanı doluysa (canlı yoklama ekranından
    //    ders saatiyle alınmış) doğrudan kullanılır → derived=false.
    //  • Kayıt gün geneliyse ("Genel"/slot boş — kurumdaki kayıtların
    //    büyük çoğunluğu böyle) o günün ders programındaki HER ders
    //    kaçırılmış sayılır → derived=true. Bu bir tahmin değil,
    //    programdan çıkarımdır ve arayüz bunu açıkça söyler.
    const slotsByDay = new Map<string, { subject: string; slot: string }[]>();
    for (const ls of lessonSlots) {
      const list = slotsByDay.get(ls.day) ?? [];
      list.push({ subject: ls.subject, slot: ls.slot });
      slotsByDay.set(ls.day, list);
    }
    const perSubject = new Map<string, { absent: number; late: number; total: number; derived: boolean }>();
    const bump = (subject: string, status: string, derived: boolean) => {
      const cur = perSubject.get(subject) ?? { absent: 0, late: 0, total: 0, derived };
      cur.total += 1;
      if (status === "ABSENT") cur.absent += 1;
      if (status === "LATE") cur.late += 1;
      // Bir ders hem gerçek hem türetilmiş kayıt taşıyorsa "türetilmiş"
      // etiketi düşer — en az bir gerçek kayıt varsa satır artık tahmin
      // değildir demek yanıltıcı olur, bu yüzden türetilmiş olan baskındır.
      cur.derived = cur.derived || derived;
      perSubject.set(subject, cur);
    };
    for (const rec of allAttendance) {
      const own = rec.subject && rec.subject !== "Genel" ? rec.subject : null;
      if (own) {
        bump(own, rec.status, false);
        continue;
      }
      const dayName = getTrDayNameForDate(rec.date);
      const lessons = dayName ? slotsByDay.get(dayName) ?? [] : [];
      for (const lesson of lessons) bump(lesson.subject, rec.status, true);
    }
    const subjectAttendance = [...perSubject.entries()]
      .map(([subject, v]) => ({ subject, ...v, rate: v.total > 0 ? Math.round(((v.total - v.absent) / v.total) * 100) : null }))
      .sort((a, b) => b.absent - a.absent || a.subject.localeCompare(b.subject, "tr"));

    const hwTotal = submissions.length;
    const hwDone = submissions.filter((s) => s.status === "DONE" || s.status === "LATE").length;

    // Denemeler: sınav bazında topla, ders kırılımını da taşı — rehberlik
    // "hangi denemede kaç net" DEĞİL, "hangi derste düşüyor" da sorar.
    const byExam = new Map<
      string,
      { name: string; date: string | null; total: number; subjects: { subject: string; net: number }[] }
    >();
    for (const r of netRows) {
      const key = r.exam?.name ?? "—";
      const cur = byExam.get(key) ?? {
        name: key,
        date: r.exam?.examDate?.toISOString() ?? null,
        total: 0,
        subjects: [],
      };
      cur.total += r.net ?? 0;
      cur.subjects.push({ subject: r.subject, net: Math.round((r.net ?? 0) * 100) / 100 });
      byExam.set(key, cur);
    }
    const exams = [...byExam.values()]
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 8)
      .map((e) => ({ ...e, total: Math.round(e.total * 100) / 100 }));

    return NextResponse.json({
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        studentNumber: student.studentNumber,
        branchName: student.branch?.name ?? null,
        grade: student.branch?.grade ?? null,
        track: student.branch?.track ?? null,
        advisorName: student.advisorTeacher
          ? `${student.advisorTeacher.firstName} ${student.advisorTeacher.lastName}`
          : null,
      },
      attendance: {
        rate: computeAttendanceRateFromCounts(counts),
        counts,
        total: attendanceCounts.reduce((s, c) => s + c._count._all, 0),
        // ⚠️ Satırda "hangi ders" (Mert: "hangi derse gelmediği yazmıyor").
        // Kaydın kendi dersi yoksa o günün ders programı yazılır.
        recent: recentAttendance.map((r) => {
          const dayName = getTrDayNameForDate(r.date);
          const lessons = dayName ? slotsByDay.get(dayName) ?? [] : [];
          const own = r.subject && r.subject !== "Genel" ? r.subject : null;
          return {
            id: r.id,
            date: r.date.toISOString(),
            slot: r.slot,
            subject: own,
            status: r.status,
            dayName,
            // Gün geneli kayıtta o gün programda olan dersler.
            scheduledSubjects: own ? [] : [...new Set(lessons.map((l) => l.subject))],
            lessonCount: own ? 1 : lessons.length,
          };
        }),
        bySubject: subjectAttendance,
      },
      homework: {
        total: hwTotal,
        done: hwDone,
        rate: hwTotal > 0 ? Math.round((hwDone / hwTotal) * 100) : null,
        items: submissions.map((s) => ({
          id: s.id,
          title: s.homework.title,
          status: s.status,
          dueAt: s.homework.dueAt?.toISOString() ?? null,
          updatedAt: s.updatedAt.toISOString(),
          targetQuestionCount: s.homework.targetQuestionCount,
          teacherName: `${s.homework.teacher.firstName} ${s.homework.teacher.lastName}`,
          subject: s.homework.teacher.subject,
        })),
      },
      xray: {
        averageMastery:
          mastery.length > 0 ? Math.round(mastery.reduce((s, m) => s + m.masteryScore, 0) / mastery.length) : null,
        weakCount: mastery.filter((m) => m.masteryScore < WEAK_MASTERY_THRESHOLD).length,
        mastery: mastery.map((m) => ({
          id: m.id,
          subject: m.subject,
          subtopicName: subtopicName(m.subject, m.subtopicId),
          masteryScore: m.masteryScore,
          assessedAt: m.assessedAt.toISOString(),
          source: m.source,
        })),
        assignments: xrayAssignments.map((a) => ({
          id: a.id,
          subject: a.subject,
          subtopicName: subtopicName(a.subject, a.subtopicId),
          status: a.status,
          assignedAt: a.assignedAt.toISOString(),
          completedAt: a.completedAt?.toISOString() ?? null,
          flagReason: a.flagReason,
          answered: a.answers.length,
          correct: a.answers.filter((ans) => ans.selectedOption.isCorrect).length,
        })),
      },
      exams,
      videos: videoAssignments.map((v) => ({
        id: v.id,
        title: v.video.title,
        subject: v.video.subject,
        assignedAt: v.assignedAt.toISOString(),
        watchedAt: v.watchedAt?.toISOString() ?? null,
        watchedSeconds: v.watchedSeconds,
        durationSeconds: v.video.durationSeconds,
        watchedPercent:
          v.watchedSeconds && v.video.durationSeconds
            ? Math.min(100, Math.round((v.watchedSeconds / v.video.durationSeconds) * 100))
            : null,
      })),
      programs: programs.map((p) => ({
        id: p.id,
        weekLabel: p.weekLabel,
        createdAt: p.createdAt.toISOString(),
        total: p.entries.length,
        done: p.entries.filter((e) => e.completedAt).length,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_academic_failed", error);
  }
}

export const GET = withApiLogging("GET /api/guidance/students/[id]/academic", handleGet);
