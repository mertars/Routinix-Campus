import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getTrDayNameForDate } from "@/lib/schedule-time";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function parseDateOnly(value: string): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

// POST /api/attendance — öğretmen bir şube+tarih+DERS SAATİ için tüm sınıfın
// yoklamasını tek seferde kaydeder. Body: { teacherId, branchId, date
// (YYYY-MM-DD), slot ("HH:MM-HH:MM"), records: [{ studentId, status }] }
// Part 4: bir satır artık bir GÜNÜ değil bir DERSİ temsil eder (bkz.
// AttendanceRecord şema notu) — bu yüzden slot artık zorunlu ve LessonSlot'a
// karşı doğrulanıyor (öğretmen kendi programında OLMAYAN bir slot için
// yoklama giremez; subject de client'ın gönderdiği serbest metin yerine
// buradan alınır — tek gerçek kaynak ders programıdır).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const teacherId = session.sub;

    const body = await request.json();
    const { branchId, date, slot, records } = body as {
      branchId?: string;
      date?: string;
      slot?: string;
      records?: { studentId: string; status: string }[];
    };

    if (!branchId || !date || !slot || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "branchId, date, slot ve records zorunludur." }, { status: 400 });
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
    const dayName = getTrDayNameForDate(day);
    const lessonSlot = dayName
      ? await prisma.lessonSlot.findUnique({
          where: { branchId_day_slot: { branchId, day: dayName, slot } },
          select: { teacherId: true, subject: true },
        })
      : null;
    if (!lessonSlot || lessonSlot.teacherId !== teacherId) {
      return NextResponse.json({ error: "Bu saatte bu şubede senin dersin görünmüyor — ders programını kontrol et." }, { status: 409 });
    }

    await prisma.$transaction([
      ...records.map((record) =>
        prisma.attendanceRecord.upsert({
          where: { studentId_date_slot: { studentId: record.studentId, date: day, slot } },
          update: { status: record.status, subject: lessonSlot.subject },
          create: { studentId: record.studentId, date: day, slot, subject: lessonSlot.subject, status: record.status },
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

// GET /api/attendance?branchId=X&date=YYYY-MM-DD&slot=HH:MM-HH:MM — o
// şube+gün+ders saati için mevcut işaretlemeleri döner (yoklama ekranını
// önceden doldurmak / "bu ders için zaten girildi mi" kontrolü için).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const branchId = request.nextUrl.searchParams.get("branchId");
    const date = request.nextUrl.searchParams.get("date");
    const slot = request.nextUrl.searchParams.get("slot");
    if (!branchId || !date || !slot) {
      return NextResponse.json({ error: "branchId, date ve slot parametreleri zorunludur." }, { status: 400 });
    }
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    const day = parseDateOnly(date);
    const students = await prisma.student.findMany({ where: { branchId }, select: { id: true } });
    const records = await prisma.attendanceRecord.findMany({
      where: { date: day, slot, studentId: { in: students.map((s) => s.id) } },
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
