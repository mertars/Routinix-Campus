import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { POSITIVE_STATUSES, EXCLUDED_FROM_RATE } from "@/lib/attendance/status";

export const dynamic = "force-dynamic";

// GÖRÜŞME ETKİSİ — "bu görüşmeden sonra ne değişti?"
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): rehberliğin yaptığı iş sistemde HİÇ
// ölçülmüyordu. Görüşme kaydı tutuluyor, not yazılıyor, program veriliyor
// ama "işe yaradı mı" sorusunun cevabı hiçbir ekranda yoktu. Oysa üç
// sinyal de zaten kayıtlı: yoklama, ödev teslimi ve deneme neti.
//
// YÖNTEM (ve sınırları, bilerek açıkça yazılıyor):
// Her görüşme için görüşme tarihinden ÖNCEKİ ve SONRAKİ WINDOW_DAYS günün
// devam oranı, ödev teslim oranı ve deneme net ortalaması karşılaştırılır.
// Bu bir NEDENSELLİK iddiası DEĞİLDİR — aynı dönemde tatil, sınav haftası
// ya da başka bir müdahale de olmuş olabilir. Arayüz bunu "etki" değil
// "görüşme sonrası değişim" diliyle sunar ve yeterli veri yoksa (her iki
// pencerede de kayıt yoksa) SAYI UYDURMAZ, null döner.
const WINDOW_DAYS = 30;
const WINDOW_MS = WINDOW_DAYS * 86_400_000;

type Window = {
  attendanceRate: number | null;
  attendanceCount: number;
  homeworkRate: number | null;
  homeworkCount: number;
  avgNet: number | null;
  examCount: number;
  /** ⚠️ Hangi denemeler karşılaştırıldı — TYT ile YKS Genel Deneme'nin
   *  toplam netleri aynı ölçek DEĞİL; isimleri göstermeden "net düştü"
   *  demek yanıltıcı olurdu. */
  examNames: string[];
};

function rateOf(rows: { status: string }[]): { rate: number | null; count: number } {
  const counted = rows.filter((r) => !EXCLUDED_FROM_RATE.includes(r.status as never));
  if (counted.length === 0) return { rate: null, count: 0 };
  const positive = counted.filter((r) => POSITIVE_STATUSES.includes(r.status as never)).length;
  return { rate: Math.round((positive / counted.length) * 100), count: counted.length };
}

async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "guidance", "principal");

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      select: { id: true, firstName: true, lastName: true, institutionId: true, branch: { select: { name: true } } },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    const [meetings, attendance, homework, nets, publicNotes] = await Promise.all([
      prisma.guidanceMeeting.findMany({
        where: { studentId: student.id },
        select: {
          id: true, scheduledAt: true, topic: true, category: true, status: true, attendee: true, outcomeNote: true,
          counselor: { select: { firstName: true, lastName: true } },
        },
        orderBy: { scheduledAt: "desc" },
        take: 30,
      }),
      // Pencere hesabı JS'te yapılıyor: görüşme başına iki ayrı sorgu
      // (öncesi/sonrası) 30 görüşmede 60 tur demekti. Öğrencinin TÜM
      // kayıtları tek seferde çekilip bellekte bölünüyor.
      prisma.attendanceRecord.findMany({ where: { studentId: student.id }, select: { date: true, status: true } }),
      prisma.homeworkSubmission.findMany({
        where: { studentId: student.id },
        select: { status: true, updatedAt: true, homework: { select: { dueAt: true, createdAt: true } } },
      }),
      prisma.examNetResult.findMany({
        where: { studentId: student.id },
        select: { net: true, exam: { select: { examDate: true, name: true } } },
      }),
      // Veliyle paylaşılan notlar — okundu mu?
      prisma.guidanceNote.findMany({
        where: { studentId: student.id, confidentialityLevel: "PUBLIC" },
        select: { id: true, note: true, authorName: true, createdAt: true, parentReadAt: true, category: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    // Deneme netleri sınav bazında toplanır (ders ders satırlar tek bir
    // denemenin parçası — toplam net karşılaştırılmalı).
    const examTotals = new Map<string, { date: Date; total: number; name: string }>();
    for (const row of nets) {
      if (!row.exam?.examDate) continue;
      const key = `${row.exam.name}|${row.exam.examDate.toISOString()}`;
      const cur = examTotals.get(key) ?? { date: row.exam.examDate, total: 0, name: row.exam.name };
      cur.total += row.net ?? 0;
      examTotals.set(key, cur);
    }
    const exams = [...examTotals.values()];

    function windowOf(center: number, side: "before" | "after"): Window {
      const from = side === "before" ? center - WINDOW_MS : center;
      const to = side === "before" ? center : center + WINDOW_MS;
      const att = attendance.filter((a) => {
        const t = a.date.getTime();
        return t >= from && t < to;
      });
      const { rate: attendanceRate, count: attendanceCount } = rateOf(att);

      // Ödevde "tarih" olarak teslim/güncellenme anı kullanılır — ödevin
      // atanma tarihi değil; ölçmek istediğimiz şey öğrencinin O DÖNEMDEKİ
      // davranışı.
      const hw = homework.filter((h) => {
        const t = (h.homework.dueAt ?? h.updatedAt).getTime();
        return t >= from && t < to;
      });
      const hwDone = hw.filter((h) => h.status === "DONE" || h.status === "LATE").length;

      const ex = exams.filter((e) => {
        const t = e.date.getTime();
        return t >= from && t < to;
      });

      return {
        attendanceRate,
        attendanceCount,
        homeworkRate: hw.length > 0 ? Math.round((hwDone / hw.length) * 100) : null,
        homeworkCount: hw.length,
        avgNet: ex.length > 0 ? Math.round((ex.reduce((s, e) => s + e.total, 0) / ex.length) * 10) / 10 : null,
        examCount: ex.length,
        examNames: ex.map((e) => e.name),
      };
    }

    const rows = meetings.map((m) => {
      const center = m.scheduledAt.getTime();
      const before = windowOf(center, "before");
      const after = windowOf(center, "after");
      return {
        id: m.id,
        scheduledAt: m.scheduledAt.toISOString(),
        topic: m.topic,
        category: m.category,
        status: m.status,
        attendee: m.attendee,
        outcomeNote: m.outcomeNote,
        counselorName: m.counselor ? `${m.counselor.firstName} ${m.counselor.lastName}` : null,
        // Görüşme GELECEKTEyse "sonrası" penceresi henüz dolmamıştır —
        // arayüz bunu ölçüm gibi göstermemeli.
        isFuture: center > Date.now(),
        // Sonrası penceresi henüz TAMAMLANMADIYSA da söylenir: 5 gün önceki
        // bir görüşmenin "30 günlük sonrası" daha bitmedi.
        windowComplete: center + WINDOW_MS <= Date.now(),
        before,
        after,
      };
    });

    return NextResponse.json({
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        branchName: student.branch?.name ?? null,
      },
      windowDays: WINDOW_DAYS,
      meetings: rows,
      sharedNotes: publicNotes.map((n) => ({
        id: n.id,
        note: n.note,
        category: n.category,
        authorName: n.authorName,
        createdAt: n.createdAt.toISOString(),
        parentReadAt: n.parentReadAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_meeting_impact_failed", error);
  }
}

export const GET = withApiLogging("GET /api/guidance/students/[id]/meeting-impact", handleGet);
