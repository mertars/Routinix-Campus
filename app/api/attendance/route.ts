import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getTrDayNameForDate } from "@/lib/schedule-time";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

import { ATTENDANCE_STATUSES } from "@/lib/attendance/status";
import { parseAttendanceDate } from "@/lib/attendance/date-key";

export const dynamic = "force-dynamic";

// Tarih anahtarı tek yerden gelir (bkz. lib/attendance/date-key.ts).

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
    // Durum listesi tek kaynaktan (bkz. lib/attendance/status).
    const validStatuses = new Set<string>(ATTENDANCE_STATUSES);
    if (records.some((r) => !r.studentId || !validStatuses.has(r.status))) {
      return NextResponse.json({ error: "Her kayıt geçerli bir studentId ve status içermeli." }, { status: 400 });
    }

    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    const day = parseAttendanceDate(date);
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

    // ⚠️ KAYITLAR ŞUBE LİSTESİYLE DOĞRULANIR.
    //
    // Burada eskiden hiçbir kontrol yoktu ve iki ayrı açık doğuruyordu:
    //
    //  1) EKSİK GİRİŞ. "Bütün öğrenciler işaretlenmeden kaydedilemez"
    //     kuralı YALNIZCA arayüzdeydi; sunucu 15 kişilik sınıfa tek
    //     kayıtlık gönderimi 201 ile kabul ediyordu (ölçüldü). Üstelik
    //     bu, eksik yoklama raporunu da yanıltıyordu: rapor "en az bir
    //     kayıt varsa girilmiş sayılır" diye çalışıyor, yani kısmi
    //     gönderim dersi "girildi" gösteriyordu.
    //
    //  2) YABANCI ÖĞRENCİ. Gönderilen studentId'nin bu şubede olup
    //     olmadığına bakılmıyordu; başka şubedeki bir öğrenci bu dersten
    //     "devamsız" yazılabiliyordu (ölçüldü). Devamsızlık kalıcı bir
    //     kayıttır: velinin gördüğü orana, risk radarına ve hatırlatma
    //     SMS'lerine işler.
    //
    // Liste AKTİF öğrencilerden kurulur — ayrılan öğrenci yoklamada
    // istenmez (bkz. yoklama listesi ucundaki aynı süzgeç).
    const roster = await prisma.student.findMany({
      where: { branchId, isActive: true },
      select: { id: true },
    });
    const rosterIds = new Set(roster.map((s) => s.id));
    const submittedIds = new Set(records.map((r) => r.studentId));

    const foreign = [...submittedIds].filter((id) => !rosterIds.has(id));
    if (foreign.length > 0) {
      return NextResponse.json(
        { error: `Bu şubede olmayan ${foreign.length} öğrenci için yoklama gönderildi.` },
        { status: 400 }
      );
    }

    const missing = [...rosterIds].filter((id) => !submittedIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `${missing.length} öğrenci işaretlenmemiş. Yoklama ancak sınıfın tamamı işaretlenince kaydedilir.`,
          missingCount: missing.length,
          rosterCount: rosterIds.size,
        },
        { status: 400 }
      );
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

    const day = parseAttendanceDate(date);
    // Pasif öğrenci yoklama listesinde çıkmamalı: öğretmen ayrılmış
    // birini işaretlemek zorunda kalıyordu ve "hepsi işaretlenmeden
    // kaydedilemez" kuralı yüzünden bu artık bir engel.
    const students = await prisma.student.findMany({ where: { branchId, isActive: true }, select: { id: true } });
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
