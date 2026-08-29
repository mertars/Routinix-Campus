import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Etüt Yönetimi Merkezi (Kampüs V2 Part 2): InstitutionSettings.isEtutAdminManaged
// AÇIK olduğunda öğrenci/öğretmen kendi randevusunu alamaz/onaylayamaz —
// TÜM atama burada, yönetici tarafından yapılır. Bu yüzden ders programı
// ızgarasıyla (LessonSlot) AYNI saat dilimi etiketlerini (ScheduleSlotDefinition)
// kullanır — kendi kendine hizmet akışındaki (bkz. lib/server/etut/
// compute-available-slots.ts) süreye bölünmüş ince slotlardan BİLEREK
// farklı: yönetici burada aynı ders programı ızgarasını görüp aynı hücreye
// (bir ders yerine) bir öğrenci atar, status doğrudan APPROVED'dır (onay
// bekleyen bir talep değil, zaten kararı veren yöneticinin ta kendisidir).

// POST /api/admin/etut-management — { teacherId, studentId, day, slot, topic }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { teacherId, studentId, day, slot, topic } = body as {
      teacherId?: string;
      studentId?: string;
      day?: string;
      slot?: string;
      topic?: string;
    };
    if (!teacherId || !studentId || !day || !slot || !topic?.trim()) {
      return NextResponse.json({ error: "teacherId, studentId, day, slot ve topic zorunludur." }, { status: 400 });
    }

    const [teacher, student] = await Promise.all([
      prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } }),
      prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true, firstName: true, lastName: true } }),
    ]);
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }
    if (!student || student.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    }

    const [conflictingLesson, conflictingAppointment, blocked] = await Promise.all([
      prisma.lessonSlot.findFirst({ where: { teacherId, day, slot }, include: { branch: { select: { name: true } } } }),
      prisma.appointmentRequest.findFirst({ where: { teacherId, day, slot, status: { in: ["PENDING", "APPROVED"] } } }),
      prisma.teacherUnavailability.findUnique({ where: { teacherId_day_slot: { teacherId, day, slot } } }),
    ]);
    if (conflictingLesson) {
      return NextResponse.json({ error: `Bu saatte ders var: ${conflictingLesson.subject} · ${conflictingLesson.branch.name}` }, { status: 409 });
    }
    if (conflictingAppointment) {
      return NextResponse.json({ error: "Bu saat zaten bir öğrenciye atanmış." }, { status: 409 });
    }
    if (blocked) {
      return NextResponse.json({ error: "Öğretmen bu saatte müsait değil." }, { status: 409 });
    }

    const appointment = await prisma.appointmentRequest.create({
      data: { studentId, teacherId, topic: topic.trim(), day, slot, status: "APPROVED", decidedAt: new Date() },
    });

    return NextResponse.json(
      { appointment: { ...appointment, student: { firstName: student.firstName, lastName: student.lastName } } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_etut_assign_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// DELETE /api/admin/etut-management?id=X — yönetici bir atamayı geri alır,
// slot yeniden boşa düşer (öğretmenin kendi onay/red akışından farklı olarak
// kayıt tamamen silinir — bkz. lib/server/... schedule-matrix'teki AYNI
// "atamayı kaldır = sil" deseni).
async function handleDelete(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id parametresi zorunludur." }, { status: 400 });

    const existing = await prisma.appointmentRequest.findUnique({ where: { id }, select: { teacher: { select: { institutionId: true } } } });
    if (!existing || existing.teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    }

    await prisma.appointmentRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_etut_unassign_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/etut-management", handlePost);
export const DELETE = withApiLogging("DELETE /api/admin/etut-management", handleDelete);
