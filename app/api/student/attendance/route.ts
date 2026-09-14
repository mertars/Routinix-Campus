import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { getMonthlyAttendance, parseMonthParam } from "@/lib/server/attendance/monthly-attendance";

export const dynamic = "force-dynamic";

// GET /api/student/attendance?month=YYYY-MM — ÖĞRENCİNİN KENDİ devamsızlığı.
//
// ⚠️ 2026-09-15 denetiminin bulgusu: devamsızlık kaydı veliye ve yöneticiye
// gösteriliyordu ama ÖĞRENCİNİN KENDİSİ göremiyordu; karnedeki tek bir yüzde
// dışında hiçbir izi yoktu. Oysa devamsızlık öğrencinin kendi davranışının
// sonucu — en çok onun görmesi gerekir.
//
// ⚠️ studentId PARAMETRE ALMAZ, oturumdan gelir: öğrenci başkasının
// devamsızlığını isteyemesin diye. Kimlik hiç dışarıdan alınmadığı için
// ayrıca bir sahiplik kontrolüne de gerek kalmıyor.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const parsed = parseMonthParam(request.nextUrl.searchParams.get("month"));
    if (!parsed) {
      return NextResponse.json({ error: "Ay 01-12 arasında olmalı (YYYY-AA)." }, { status: 400 });
    }

    const data = await getMonthlyAttendance(session.sub, parsed.year, parsed.month);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("student_attendance_failed", error);
  }
}

export const GET = withApiLogging("GET /api/student/attendance", handleGet);
