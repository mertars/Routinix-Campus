import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { findMissingAttendance } from "@/lib/server/attendance/missing-attendance";

export const dynamic = "force-dynamic";

// GET ?date=YYYY-MM-DD — o gün programda olup yoklaması girilmemiş dersler.
// Tarih verilmezse bugün.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const param = request.nextUrl.searchParams.get("date");
    const date = param ? new Date(param) : new Date();
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Tarih geçerli olmalı (YYYY-AA-GG)." }, { status: 400 });
    }

    const report = await findMissingAttendance(session.institutionId, date);
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("missing_attendance_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/attendance/missing", handleGet);
