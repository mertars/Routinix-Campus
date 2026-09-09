import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { ATTENDANCE_LABEL, computeAttendanceRateFromCounts, type AttendanceStatus } from "@/lib/attendance/status";

export const dynamic = "force-dynamic";

// GET /api/parent/attendance/[studentId]?month=YYYY-MM
//
// Bir dershane velisinin en sık sorduğu soru "çocuğum bugün derse geldi
// mi?" idi ve sistemde bunun karşılığı YOKTU: veli yalnızca tek bir
// yüzde görüyordu (bkz. /api/parent/me). Yüzde, "dün gelmemiş" ile
// "üç haftadır gelmiyor"u aynı gösterir.
//
// Uç AY BAZINDA çalışır. Tüm geçmişi dönmek, veli panelini üç yıllık
// veriyle yüklemek demekti — bu fazda tam tersini yapmak için uğraşıldı.
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "parent");
    await assertParentOwnsStudent(session.sub, params.studentId);

    const monthParam = request.nextUrl.searchParams.get("month");
    const now = new Date();
    const [yearStr, monthStr] = (monthParam ?? "").split("-");
    const year = Number(yearStr) || now.getUTCFullYear();
    // Ay 1-12 gelir, Date.UTC 0-11 bekler.
    const month = (Number(monthStr) || now.getUTCMonth() + 1) - 1;
    if (month < 0 || month > 11) {
      return NextResponse.json({ error: "Ay 01-12 arasında olmalı (YYYY-AA)." }, { status: 400 });
    }

    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 1));

    const [records, allCounts] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { studentId: params.studentId, date: { gte: from, lt: to } },
        select: { date: true, slot: true, subject: true, status: true },
        orderBy: [{ date: "asc" }, { slot: "asc" }],
      }),
      // Dönemin geneli: tek bir ayın oranı yanıltıcı olabilir, veli
      // "genel durum" ile "bu ay" arasındaki farkı görebilmeli.
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { studentId: params.studentId },
        _count: { _all: true },
      }),
    ]);

    const monthCounts: Record<string, number> = {};
    for (const r of records) monthCounts[r.status] = (monthCounts[r.status] ?? 0) + 1;

    const overallCounts: Record<string, number> = {};
    for (const r of allCounts) overallCounts[r.status] = r._count._all;

    // Gün gün grupla — veli takvim gibi okusun, satır listesi gibi değil.
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

    return NextResponse.json({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      days: [...byDay.entries()].map(([date, lessons]) => ({
        date,
        lessons,
        // Günün özeti: o gün hiç gelmemiş mi, yoksa bir dersi mi kaçırmış?
        absentCount: lessons.filter((l) => l.status === "ABSENT").length,
        totalCount: lessons.length,
      })),
      monthRate: computeAttendanceRateFromCounts(monthCounts),
      overallRate: computeAttendanceRateFromCounts(overallCounts),
      monthCounts,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("parent_attendance_failed", error);
  }
}

export const GET = withApiLogging("GET /api/parent/attendance/[studentId]", handleGet);
