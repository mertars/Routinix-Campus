import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

function parseDateOnly(value: string): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

// POST /api/attendance — öğretmen bir şube+tarih için tüm sınıfın yoklamasını
// tek seferde kaydeder. Body: { teacherId, branchId, date (YYYY-MM-DD),
// records: [{ studentId, status: "PRESENT"|"ABSENT"|"LATE" }] }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const teacherId = session.sub;

    const body = await request.json();
    const { branchId, date, records } = body as {
      branchId?: string;
      date?: string;
      records?: { studentId: string; status: string }[];
    };

    if (!branchId || !date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "branchId, date ve records zorunludur." }, { status: 400 });
    }
    const validStatuses = new Set(["PRESENT", "ABSENT", "LATE"]);
    if (records.some((r) => !r.studentId || !validStatuses.has(r.status))) {
      return NextResponse.json({ error: "Her kayıt geçerli bir studentId ve status içermeli." }, { status: 400 });
    }

    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    const day = parseDateOnly(date);

    await prisma.$transaction([
      ...records.map((record) =>
        prisma.attendanceRecord.upsert({
          where: { studentId_date: { studentId: record.studentId, date: day } },
          update: { status: record.status },
          create: { studentId: record.studentId, date: day, status: record.status },
        })
      ),
      prisma.attendanceSubmission.create({
        data: { teacherId, branchId, date: day, recordCount: records.length },
      }),
    ]);

    return NextResponse.json({ ok: true, recordCount: records.length }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("attendance_submit_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/attendance?branchId=X&date=YYYY-MM-DD — o şube+gün için mevcut
// işaretlemeleri döner (yoklama ekranını önceden doldurmak / "bugün zaten
// girildi mi" kontrolü için).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const branchId = request.nextUrl.searchParams.get("branchId");
    const date = request.nextUrl.searchParams.get("date");
    if (!branchId || !date) {
      return NextResponse.json({ error: "branchId ve date parametreleri zorunludur." }, { status: 400 });
    }
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    const day = parseDateOnly(date);
    const students = await prisma.student.findMany({ where: { branchId }, select: { id: true } });
    const records = await prisma.attendanceRecord.findMany({
      where: { date: day, studentId: { in: students.map((s) => s.id) } },
      select: { studentId: true, status: true },
    });

    return NextResponse.json({ records });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("attendance_lookup_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/attendance", handlePost);
export const GET = withApiLogging("GET /api/attendance", handleGet);
