import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { getTeacherDaySlots } from "@/lib/server/etut/get-teacher-day-slots";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// POST /api/appointments — öğrenci KENDİSİ için bir öğretmenden birebir etüt
// talep eder. studentId body'den değil oturumdan alınır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "STUDENT") {
      throw new AuthError("Sadece öğrenciler randevu talep edebilir.", "FORBIDDEN_ROLE", 403);
    }
    const studentId = session.sub;

    const body = await request.json();
    const { teacherId, topic, day, slot } = body as {
      teacherId?: string;
      topic?: string;
      day?: string;
      slot?: string;
    };

    if (!teacherId || !topic?.trim() || !day || !slot) {
      return NextResponse.json({ error: "teacherId, topic, day ve slot zorunludur." }, { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true, institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    // Sabit "aynı slot" karşılaştırması yerine ŞU AN gerçekten müsait olan
    // slot listesiyle doğrulama — mola tamponunu ve PENDING taleplerin de
    // yer tuttuğunu hesaba katar (bkz. lib/server/etut/get-teacher-day-slots.ts).
    const currentlyAvailable = await getTeacherDaySlots(session.institutionId, teacherId, day);
    if (!currentlyAvailable.includes(slot)) {
      return NextResponse.json({ error: "Bu saat artık müsait değil, lütfen başka bir saat seçin." }, { status: 409 });
    }

    const appointment = await prisma.appointmentRequest.create({
      data: { studentId, teacherId, topic: topic.trim(), day, slot },
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("appointment_create_failed", error);
  }
}

// GET /api/appointments?studentId=X — o öğrencinin randevuları (öğrencinin
// kendisi / danışman-branş öğretmeni / velisi / yönetici erişebilir).
// GET /api/appointments?teacherId=X — o öğretmenin randevuları. Öğretmenin
// KENDİSİ veya yönetici tam detay (öğrenci adı+konu) görür; başka biri
// (örn. müsaitlik kontrolü yapan bir öğrenci) sadece dolu gün/saatleri görür,
// kimin randevusu olduğunu göremez.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const studentId = request.nextUrl.searchParams.get("studentId");
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    const isFeed = request.nextUrl.searchParams.get("feed") === "true";

    // ?feed=true — yönetici canlı akışı: son işaretlenen etüt tamamlamaları
    // (bkz. components/principal/live-teacher-feed.tsx > "Etüt Tamamlama").
    if (isFeed) {
      requireRole(session, "principal");
      const limit = Math.min(20, Number(request.nextUrl.searchParams.get("limit") ?? "4") || 4);
      const rows = await prisma.appointmentRequest.findMany({
        where: { teacher: { institutionId: session.institutionId }, status: { in: ["COMPLETED", "NO_SHOW"] } },
        orderBy: { completedAt: "desc" },
        take: limit,
        include: { student: { select: { firstName: true, lastName: true } }, teacher: { select: { firstName: true, lastName: true } } },
      });
      return NextResponse.json({
        appointments: rows.map((r) => ({
          id: r.id,
          studentName: `${r.student.firstName} ${r.student.lastName}`,
          teacherName: `${r.teacher.firstName} ${r.teacher.lastName}`,
          status: r.status,
          completionNote: r.completionNote,
          decidedAt: r.completedAt?.toISOString() ?? r.requestedAt.toISOString(),
        })),
      });
    }

    if (!studentId && !teacherId) {
      return NextResponse.json({ error: "studentId veya teacherId parametrelerinden biri zorunludur." }, { status: 400 });
    }

    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
      if (!student || student.institutionId !== session.institutionId) {
        return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
      }
      if (session.role === "STUDENT") {
        if (session.sub !== studentId) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
      } else if (session.role === "TEACHER") {
        await assertTeacherOwnsStudent(session.sub, studentId);
      } else if (session.role === "PARENT") {
        await assertParentOwnsStudent(session.sub, studentId);
      }

      const appointments = await prisma.appointmentRequest.findMany({
        where: { studentId },
        include: {
          student: { select: { firstName: true, lastName: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
        orderBy: { requestedAt: "desc" },
      });
      return NextResponse.json({ appointments });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId! }, select: { institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    const isOwnerOrAdmin = (session.role === "TEACHER" && session.sub === teacherId) || session.role === "ADMIN";
    const appointments = await prisma.appointmentRequest.findMany({
      where: { teacherId: teacherId! },
      include: isOwnerOrAdmin
        ? { student: { select: { firstName: true, lastName: true } }, teacher: { select: { firstName: true, lastName: true } } }
        : undefined,
      orderBy: { requestedAt: "desc" },
    });

    // Sahibi/yönetici değilse (örn. müsaitlik kontrolü yapan bir öğrenci)
    // sadece dolu gün/saat/durum döner — kimin randevusu olduğu sızdırılmaz.
    const payload = isOwnerOrAdmin
      ? appointments
      : appointments.map((a) => ({ id: a.id, day: a.day, slot: a.slot, status: a.status }));

    return NextResponse.json({ appointments: payload });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("appointments_list_failed", error);
  }
}

export const POST = withApiLogging("POST /api/appointments", handlePost);
export const GET = withApiLogging("GET /api/appointments", handleGet);
