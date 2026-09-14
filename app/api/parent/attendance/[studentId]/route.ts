import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { getMonthlyAttendance, parseMonthParam } from "@/lib/server/attendance/monthly-attendance";

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

    const parsed = parseMonthParam(request.nextUrl.searchParams.get("month"));
    if (!parsed) {
      return NextResponse.json({ error: "Ay 01-12 arasında olmalı (YYYY-AA)." }, { status: 400 });
    }

    // Hesap ortak serviste — öğrenci ucu (app/api/student/attendance) da
    // aynısını kullanır, biri düzeltilince diğeri de düzelir.
    const data = await getMonthlyAttendance(params.studentId, parsed.year, parsed.month);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("parent_attendance_failed", error);
  }
}

export const GET = withApiLogging("GET /api/parent/attendance/[studentId]", handleGet);
