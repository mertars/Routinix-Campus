import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { computeAttendanceRateFromCounts } from "@/lib/attendance/status";

export const dynamic = "force-dynamic";

// ÖĞRENCİ REHBERLİK DOSYASI — tek uçta "bu öğrenci hakkında bildiğim her şey".
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15): "rehberlik sistemi hâlâ çok ilkel ve
// tasarım anlamında kullanışsız... görüşme geçmişleri, notlar, verilen
// programlar vs. hepsi bulunsun". Bu veriler zaten vardı ama ÜÇ AYRI
// uçta ve hiçbiri bir arada görünmüyordu: rehber öğretmen görüşmeye
// girerken öğrencinin geçmişini parça parça aramak zorundaydı.
//
// Tek uç olması bilinçli: ekran açılışında üç ayrı istek yerine bir tane —
// ve daha önemlisi, üç kaynak TEK BİR ZAMAN TÜNELİNDE birleştirilebiliyor
// (görüşme, not ve program aynı kronolojide okunmalı; "şu görüşmeden sonra
// bu programı verdim" ancak böyle görülür).
//
// Yetki: rehberlik ve yönetici. Rehberlik kurum genelinde çalışır (bkz.
// session-guard > assertCanReadBranch merdiveni), bu yüzden öğrenci
// kontrolü "aynı kurumda mı" ile sınırlıdır.
//
// ⚠️ FİNANS YOK. Öğrenci 360'taki aynı kural — borç rehberlik görüşmesinin
// konusu değil ve Ödeme Takip bu role hiç açılmadı.

type TimelineItem =
  | { kind: "meeting"; id: string; at: string; title: string; detail: string | null; status: string; attendee: string; category: string }
  | { kind: "note"; id: string; at: string; title: string; detail: string; category: string; confidentiality: string; author: string }
  | { kind: "program"; id: string; at: string; title: string; detail: string; entryCount: number };

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
        branch: { select: { id: true, name: true, grade: true, track: true } },
        advisorTeacher: { select: { firstName: true, lastName: true, subject: true } },
        parents: { select: { parent: { select: { firstName: true, lastName: true, mobilePhone: true } } } },
      },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    // ⚠️ Beş sorgu BİRBİRİNDEN BAĞIMSIZ — ardışık atılsalardı ekran açılışı
    // beş ağ turu sürerdi (bkz. lib/server/agenda ve teacher-student-card'daki
    // aynı gerekçe). Tek Promise.all.
    const [meetings, notes, programs, attendanceCounts, exams] = await Promise.all([
      prisma.guidanceMeeting.findMany({
        where: { studentId: student.id },
        select: {
          id: true, scheduledAt: true, topic: true, category: true, status: true,
          outcomeNote: true, attendee: true, durationMin: true,
          counselor: { select: { firstName: true, lastName: true } },
        },
        orderBy: { scheduledAt: "desc" },
        take: 50,
      }),
      prisma.guidanceNote.findMany({
        where: { studentId: student.id },
        select: { id: true, note: true, category: true, confidentialityLevel: true, authorName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.guidanceProgram.findMany({
        where: { studentId: student.id },
        select: { id: true, weekLabel: true, createdAt: true, _count: { select: { entries: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { studentId: student.id },
        _count: { _all: true },
      }),
      // Son denemeler — "öğrencinin derecesi" sorusunun cevabı.
      prisma.examNetResult.findMany({
        where: { studentId: student.id },
        select: { id: true, subject: true, net: true, exam: { select: { name: true, examDate: true } } },
        orderBy: { id: "desc" },
        take: 40,
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const row of attendanceCounts) counts[row.status] = row._count._all;
    const absentCount = counts.ABSENT ?? 0;

    // Denemeleri sınav bazında topla — rehberlik "hangi denemede kaç net"
    // görmeli, ders ders dökümü burada gürültü olur.
    const byExam = new Map<string, { name: string; date: string | null; total: number }>();
    for (const r of exams) {
      const key = r.exam?.name ?? "—";
      const cur = byExam.get(key) ?? { name: key, date: r.exam?.examDate?.toISOString() ?? null, total: 0 };
      cur.total += r.net ?? 0;
      byExam.set(key, cur);
    }

    const timeline: TimelineItem[] = [
      ...meetings.map((m): TimelineItem => ({
        kind: "meeting",
        id: m.id,
        at: m.scheduledAt.toISOString(),
        title: m.topic,
        detail: m.outcomeNote,
        status: m.status,
        attendee: m.attendee,
        category: m.category,
      })),
      ...notes.map((n): TimelineItem => ({
        kind: "note",
        id: n.id,
        at: n.createdAt.toISOString(),
        title: "Görüşme notu",
        detail: n.note,
        category: n.category,
        confidentiality: n.confidentialityLevel,
        author: n.authorName,
      })),
      ...programs.map((p): TimelineItem => ({
        kind: "program",
        id: p.id,
        at: p.createdAt.toISOString(),
        title: p.weekLabel,
        detail: `${p._count.entries} çalışma bloğu`,
        entryCount: p._count.entries,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    return NextResponse.json({
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        studentNumber: student.studentNumber,
        branchName: student.branch?.name ?? null,
        grade: student.branch?.grade ?? null,
        track: student.branch?.track ?? null,
        advisorName: student.advisorTeacher
          ? `${student.advisorTeacher.firstName} ${student.advisorTeacher.lastName} (${student.advisorTeacher.subject})`
          : null,
        parents: student.parents.map((p) => ({
          name: `${p.parent.firstName} ${p.parent.lastName}`,
          phone: p.parent.mobilePhone,
        })),
      },
      academic: {
        attendanceRate: computeAttendanceRateFromCounts(counts),
        absentCount,
        exams: [...byExam.values()]
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
          .slice(0, 6)
          .map((e) => ({ name: e.name, date: e.date, net: Math.round(e.total * 100) / 100 })),
      },
      counts: { meetings: meetings.length, notes: notes.length, programs: programs.length },
      timeline,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_dossier_failed", error);
  }
}

export const GET = withApiLogging("GET /api/guidance/students/[id]/dossier", handleGet);
