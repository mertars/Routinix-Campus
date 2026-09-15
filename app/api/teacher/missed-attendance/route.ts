import { NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { findTeacherMissedLessons, MISSING_LOOKBACK_DAYS } from "@/lib/server/attendance/teacher-missing-attendance";

export const dynamic = "force-dynamic";

// GET /api/teacher/missed-attendance — öğretmenin GEÇMİŞTE girmediği kendi
// yoklamaları (bkz. lib/server/attendance/teacher-missing-attendance.ts).
//
// ⚠️ PARAMETRE ALMAZ. Liste her zaman session.sub'tan üretilir — bir
// öğretmen başka bir öğretmenin eksiklerini sorgulayamaz (bkz. CLAUDE.md:
// "HİÇBİR API route client'tan gelen id'ye güvenmez").
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const lessons = await findTeacherMissedLessons(session.sub);
    return NextResponse.json({ lessons, lookbackDays: MISSING_LOOKBACK_DAYS });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("teacher_missed_attendance_failed", error);
  }
}

export const GET = withApiLogging("GET /api/teacher/missed-attendance", handleGet);
