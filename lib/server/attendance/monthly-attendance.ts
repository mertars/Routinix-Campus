import { prisma } from "@/lib/server/prisma";
import { ATTENDANCE_LABEL, computeAttendanceRateFromCounts, type AttendanceStatus } from "@/lib/attendance/status";

// BİR ÖĞRENCİNİN AYLIK YOKLAMA DÖKÜMÜ.
//
// ⚠️ Neden ayrı bir dosya: bu döküm önce SADECE veli ucunun içindeydi
// (app/api/parent/attendance/[studentId]). 2026-09-15 denetiminde çıktı ki
// ÖĞRENCİ kendi devamsızlığını hiçbir yerden göremiyor — veli görüyor,
// yönetici görüyor, öğrencinin kendisi göremiyor. Mantığı kopyalamak yerine
// buraya alındı; iki uç da (veli + öğrenci) aynı hesabı kullanır, biri
// düzeltilince diğeri de düzelir.
//
// Uç AY BAZINDA çalışır: tüm geçmişi dönmek paneli üç yıllık veriyle
// yüklemek demekti.

export type MonthlyAttendance = {
  month: string;
  days: {
    date: string;
    lessons: { slot: string; subject: string; status: string; label: string }[];
    absentCount: number;
    totalCount: number;
  }[];
  monthRate: number;
  overallRate: number;
  monthCounts: Record<string, number>;
};

export function parseMonthParam(monthParam: string | null): { year: number; month: number } | null {
  const now = new Date();
  const [yearStr, monthStr] = (monthParam ?? "").split("-");
  const year = Number(yearStr) || now.getUTCFullYear();
  // Ay 1-12 gelir, Date.UTC 0-11 bekler.
  const month = (Number(monthStr) || now.getUTCMonth() + 1) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}

export async function getMonthlyAttendance(
  studentId: string,
  year: number,
  month: number
): Promise<MonthlyAttendance> {
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 1));

  const [records, allCounts] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { studentId, date: { gte: from, lt: to } },
      select: { date: true, slot: true, subject: true, status: true },
      orderBy: [{ date: "asc" }, { slot: "asc" }],
    }),
    // Dönemin geneli: tek bir ayın oranı yanıltıcı olabilir; "genel durum"
    // ile "bu ay" arasındaki fark görünmeli.
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { studentId },
      _count: { _all: true },
    }),
  ]);

  const monthCounts: Record<string, number> = {};
  for (const r of records) monthCounts[r.status] = (monthCounts[r.status] ?? 0) + 1;

  const overallCounts: Record<string, number> = {};
  for (const r of allCounts) overallCounts[r.status] = r._count._all;

  // Gün gün grupla — takvim gibi okunsun, satır listesi gibi değil.
  const byDay = new Map<string, { slot: string; subject: string; status: string; label: string }[]>();
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);
    byDay.set(key, [
      ...(byDay.get(key) ?? []),
      {
        slot: r.slot,
        subject: r.subject,
        status: r.status,
        label: ATTENDANCE_LABEL[r.status as AttendanceStatus] ?? r.status,
      },
    ]);
  }

  return {
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
    days: [...byDay.entries()].map(([date, lessons]) => ({
      date,
      lessons,
      absentCount: lessons.filter((l) => l.status === "ABSENT").length,
      totalCount: lessons.length,
    })),
    monthRate: computeAttendanceRateFromCounts(monthCounts),
    overallRate: computeAttendanceRateFromCounts(overallCounts),
    monthCounts,
  };
}
